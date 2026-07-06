import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import { decrypt } from '@/lib/whatsapp/encryption'
import { deleteMessageTemplate, editMessageTemplate } from '@/lib/whatsapp/meta-api'
import { buildMetaTemplatePayload } from '@/lib/whatsapp/template-components'
import { ensureImageHeaderHandle } from '@/lib/whatsapp/template-header-handle'
import {
  validateTemplatePayload,
  type TemplatePayload,
} from '@/lib/whatsapp/template-validators'

const EDITABLE_STATUSES = new Set(['APPROVED', 'Approved', 'REJECTED', 'Rejected', 'PAUSED'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isDryRun(): boolean {
  return (
    process.env.WHATSAPP_TEMPLATES_DRY_RUN === 'true' ||
    process.env.WHATSAPP_TEMPLATES_DRY_RUN === '1'
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 })

    const guard = await requireWorkspacePermission('manage_local_templates')
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    let payload: TemplatePayload
    try {
      payload = (await request.json()) as TemplatePayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: existing, error: lookupError } = await admin
      .from('message_templates')
      .select('id, name, status, meta_template_id, language')
      .eq('id', id)
      .eq('workspace_id', guard.workspace.workspaceId)
      .maybeSingle()

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 })

    if (!existing.meta_template_id) {
      return NextResponse.json(
        { error: 'This template was never submitted to Meta — use New Template to submit it instead.' },
        { status: 400 },
      )
    }

    if (!EDITABLE_STATUSES.has(String(existing.status))) {
      return NextResponse.json(
        {
          error: `Templates in status ${existing.status} cannot be edited. Allowed: APPROVED, REJECTED, PAUSED.`,
        },
        { status: 400 },
      )
    }

    if (payload.category === 'Authentication') {
      return NextResponse.json(
        { error: 'AUTHENTICATION templates are not editable here — manage them in Meta WhatsApp Manager.' },
        { status: 400 },
      )
    }

    try {
      validateTemplatePayload(payload)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Validation failed.' },
        { status: 400 },
      )
    }

    if (!isDryRun()) {
      const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
        waba_id?: string | null
        access_token: string
      }>({
        workspaceId: guard.workspace.workspaceId,
        columns: '*',
      })
      if (configError || !config) {
        return NextResponse.json({ error: 'WhatsApp not configured.' }, { status: 400 })
      }

      const accessToken = decrypt(config.access_token)
      try {
        await ensureImageHeaderHandle(payload, accessToken)
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Header image upload failed.' },
          { status: 400 },
        )
      }

      try {
        const metaPayload = buildMetaTemplatePayload(payload)
        await editMessageTemplate({
          metaTemplateId: String(existing.meta_template_id),
          accessToken,
          components: metaPayload.components,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meta edit failed.'
        await admin
          .from('message_templates')
          .update({
            submission_error: message,
            last_submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('workspace_id', guard.workspace.workspaceId)
        return NextResponse.json({ error: message }, { status: 502 })
      }
    }

    const { data: row, error: updateError } = await admin
      .from('message_templates')
      .update({
        category: payload.category,
        header_type: payload.header_type ?? null,
        header_content: payload.header_content ?? null,
        header_media_url: payload.header_media_url ?? null,
        header_handle: payload.header_handle ?? null,
        body_text: payload.body_text,
        footer_text: payload.footer_text ?? null,
        buttons: payload.buttons ?? null,
        sample_values: payload.sample_values ?? null,
        status: 'PENDING',
        submission_error: null,
        rejection_reason: null,
        last_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', guard.workspace.workspaceId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: `Edited on Meta but failed to save locally: ${updateError.message}. Run "Sync from Meta" to recover.` },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, template: row, dry_run: isDryRun() })
  } catch (error) {
    console.error('Error editing template:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to edit template.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 })

    const guard = await requireWorkspacePermission('manage_local_templates')
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const admin = supabaseAdmin()
    const { data: existing, error: lookupError } = await admin
      .from('message_templates')
      .select('id, name, meta_template_id')
      .eq('id', id)
      .eq('workspace_id', guard.workspace.workspaceId)
      .maybeSingle()

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 })

    if (existing.meta_template_id && !isDryRun()) {
      const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
        waba_id?: string | null
        access_token: string
      }>({
        workspaceId: guard.workspace.workspaceId,
        columns: '*',
      })
      if (configError || !config?.waba_id) {
        return NextResponse.json(
          { error: 'WhatsApp not configured — cannot delete on Meta.' },
          { status: 400 },
        )
      }

      try {
        await deleteMessageTemplate({
          wabaId: config.waba_id,
          accessToken: decrypt(config.access_token),
          name: existing.name,
          metaTemplateId: existing.meta_template_id,
        })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Meta delete failed.' },
          { status: 502 },
        )
      }
    }

    const { error: deleteError } = await admin
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('workspace_id', guard.workspace.workspaceId)

    if (deleteError) {
      return NextResponse.json(
        { error: `Deleted on Meta but failed to delete locally: ${deleteError.message}.` },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, dry_run: isDryRun() })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete template.' },
      { status: 500 },
    )
  }
}
