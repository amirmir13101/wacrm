import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { encrypt } from '@/lib/whatsapp/encryption'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'

const DEFAULT_GRAPH_API_VERSION = 'v21.0'

interface ExchangeResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; code?: number; type?: string }
}

function getServerConfig() {
  return {
    appId: process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphApiVersion: process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION,
  }
}

async function exchangeCodeForToken(args: {
  code: string
  appId: string
  appSecret: string
  graphApiVersion: string
}) {
  const params = new URLSearchParams({
    client_id: args.appId,
    client_secret: args.appSecret,
    code: args.code,
  })

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/oauth/access_token?${params.toString()}`,
    { method: 'GET' },
  )
  const payload = (await response.json().catch(() => ({}))) as ExchangeResponse

  if (!response.ok || !payload.access_token) {
    const message = payload.error?.message || `Meta code exchange failed: ${response.status}`
    throw new Error(message)
  }

  return payload.access_token
}

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
      return NextResponse.json(
        { error: 'You cannot manage WhatsApp configuration' },
        { status: 403 },
      )
    }

    const serverConfig = getServerConfig()
    if (!serverConfig.appId || !serverConfig.appSecret) {
      return NextResponse.json(
        { error: 'Meta Embedded Signup is not configured for this CRM installation.' },
        { status: 400 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown
      phone_number_id?: unknown
      waba_id?: unknown
    }
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const phoneNumberId =
      typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : ''
    const wabaId = typeof body.waba_id === 'string' ? body.waba_id.trim() : ''

    if (!code || !phoneNumberId) {
      return NextResponse.json(
        { error: 'Meta signup did not return a code and phone number ID.' },
        { status: 400 },
      )
    }

    const accessToken = await exchangeCodeForToken({
      code,
      appId: serverConfig.appId,
      appSecret: serverConfig.appSecret,
      graphApiVersion: serverConfig.graphApiVersion,
    })

    const phoneInfo = await verifyPhoneNumber({
      phoneNumberId,
      accessToken,
    })

    const encryptedAccessToken = encrypt(accessToken)
    const admin = supabaseAdmin()

    const { data: existing } = await admin
      .from('whatsapp_config')
      .select('id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('user_id', workspace.userId)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('whatsapp_config')
        .update({
          phone_number_id: phoneNumberId,
          waba_id: wabaId || null,
          access_token: encryptedAccessToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('[whatsapp embedded signup] update failed:', error)
        return NextResponse.json({ error: 'Failed to save WhatsApp configuration' }, { status: 500 })
      }
    } else {
      const { error } = await admin.from('whatsapp_config').insert({
        user_id: workspace.userId,
        workspace_id: workspace.workspaceId,
        phone_number_id: phoneNumberId,
        waba_id: wabaId || null,
        access_token: encryptedAccessToken,
        verify_token: null,
        status: 'connected',
        connected_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[whatsapp embedded signup] insert failed:', error)
        return NextResponse.json({ error: 'Failed to save WhatsApp configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      phone_info: phoneInfo,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Meta Embedded Signup error'
    console.error('[whatsapp embedded signup] callback failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
