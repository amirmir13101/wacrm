import { NextResponse } from 'next/server'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'

/**
 * GET /api/whatsapp/config
 *
 * Used by the "Test API Connection" button and by the page to check
 * whether the saved config is healthy. Returns 200 in all non-auth cases
 * so the UI can render an appropriate message rather than show a 500.
 *
 * Response shape:
 *   { connected: true,  phone_info: {...} }
 *   { connected: false, reason: 'no_config',        message: '...' }
 *   { connected: false, reason: 'token_corrupted',  message: '...', needs_reset: true }
 *   { connected: false, reason: 'meta_api_error',   message: '...' }
 */
export async function GET() {
  try {
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
    }
    const workspace = workspaceResult.workspace
    const subject = {
      role: workspace.role,
      permissions: workspace.permissions,
      can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
    }
    const canManage = hasWorkspacePermission(subject, 'manage_whatsapp_config')
    const canConnectOwn = hasWorkspacePermission(subject, 'connect_own_whatsapp_config')

    const {
      config,
      source,
      error: configError,
    } = await findWorkspaceWhatsAppConfig<{
      phone_number_id: string
      access_token: string
      status: string
    }>({
      workspaceId: workspace.workspaceId,
      columns: 'phone_number_id, access_token, status',
    })

    if (configError) {
      console.error('Error fetching whatsapp_config:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration' },
        { status: 200 }
      )
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: canManage || canConnectOwn
            ? 'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.'
            : 'Workspace WhatsApp is not connected. Ask the workspace owner to configure it.',
        },
        { status: 200 }
      )
    }

    // Try to decrypt the stored token with the current ENCRYPTION_KEY.
    // If this fails, the key changed (or was never consistent across envs).
    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch (err) {
      console.error('[whatsapp/config GET] Token decryption failed:', err)
      return NextResponse.json(
        {
          connected: false,
          reason: 'token_corrupted',
          needs_reset: canManage || canConnectOwn,
          message: canManage || canConnectOwn
            ? 'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click "Reset Configuration" below, then re-save.'
            : 'Workspace WhatsApp needs owner attention before messaging is available.',
        },
        { status: 200 }
      )
    }

    // Validate credentials against Meta
    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
      return NextResponse.json({
        connected: true,
        phone_info: phoneInfo,
        managed_by_owner: !(canManage || canConnectOwn),
        legacy_config_source: source === 'legacy_member',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[whatsapp/config GET] Meta API verification failed:', message)
      return NextResponse.json(
        {
          connected: false,
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${message}`,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates the WhatsApp config for the authenticated user.
 * Verifies credentials with Meta first, then encrypts and stores.
 */
export async function POST(request: Request) {
  try {
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
    }
    const workspace = workspaceResult.workspace
    const subject = {
      role: workspace.role,
      permissions: workspace.permissions,
      can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
    }
    if (
      !hasWorkspacePermission(subject, 'manage_whatsapp_config') &&
      !hasWorkspacePermission(subject, 'connect_own_whatsapp_config')
    ) {
      return NextResponse.json({ error: 'You cannot manage WhatsApp configuration' }, { status: 403 })
    }

    const body = await request.json()
    const { phone_number_id, waba_id, access_token, verify_token } = body

    if (!access_token || !phone_number_id) {
      return NextResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      )
    }

    // Verify credentials with Meta BEFORE saving
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: access_token,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('Meta API verification failed during save:', message)
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 400 }
      )
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    try {
      encryptedAccessToken = encrypt(access_token)
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('Encryption failed:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
        },
        { status: 500 }
      )
    }

    // Upsert — overwrite any existing (possibly corrupted) config
    const admin = supabaseAdmin()
    const { data: existing } = await admin
      .from('whatsapp_config')
      .select('id')
      .eq('workspace_id', workspace.workspaceId)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await admin
        .from('whatsapp_config')
        .update({
          phone_number_id,
          waba_id: waba_id || null,
          access_token: encryptedAccessToken,
          verify_token: encryptedVerifyToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating whatsapp_config:', updateError)
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        )
      }
    } else {
      const { error: insertError } = await admin
        .from('whatsapp_config')
        .insert({
          user_id: workspace.userId,
          workspace_id: workspace.workspaceId,
          phone_number_id,
          waba_id: waba_id || null,
          access_token: encryptedAccessToken,
          verify_token: encryptedVerifyToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Error inserting whatsapp_config:', insertError)
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, phone_info: phoneInfo })
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removes the authenticated user's WhatsApp configuration row.
 * Used by the "Reset Configuration" button to recover from a corrupted
 * encrypted token (mismatched ENCRYPTION_KEY across environments).
 */
export async function DELETE() {
  try {
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
    }
    const workspace = workspaceResult.workspace
    const subject = {
      role: workspace.role,
      permissions: workspace.permissions,
      can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
    }
    if (
      !hasWorkspacePermission(subject, 'manage_whatsapp_config') &&
      !hasWorkspacePermission(subject, 'connect_own_whatsapp_config')
    ) {
      return NextResponse.json({ error: 'You cannot manage WhatsApp configuration' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin()
      .from('whatsapp_config')
      .delete()
      .eq('workspace_id', workspace.workspaceId)

    if (deleteError) {
      console.error('Error deleting whatsapp_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
