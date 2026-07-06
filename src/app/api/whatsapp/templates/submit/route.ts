import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import { decrypt } from '@/lib/whatsapp/encryption'
import { submitMessageTemplate } from '@/lib/whatsapp/meta-api'
import { buildMetaTemplatePayload } from '@/lib/whatsapp/template-components'
import { ensureImageHeaderHandle } from '@/lib/whatsapp/template-header-handle'
import { normalizeStatus } from '@/lib/whatsapp/template-status-normalize'
import {
  validateTemplatePayload,
  type TemplatePayload,
} from '@/lib/whatsapp/template-validators'

function buildTemplateRow(
  workspaceId: string,
  userId: string,
  payload: TemplatePayload,
  extras: {
    status: 'DRAFT' | string
    metaTemplateId: string | null
    submissionError: string | null
  },
) {
  return {
    workspace_id: workspaceId,
    user_id: userId,
    name: payload.name,
    category: payload.category,
    language: payload.language,
    header_type: payload.header_type ?? null,
    header_content: payload.header_content ?? null,
    header_media_url: payload.header_media_url ?? null,
    header_handle: payload.header_handle ?? null,
    body_text: payload.body_text,
    footer_text: payload.footer_text ?? null,
    buttons: payload.buttons ?? null,
    sample_values: payload.sample_values ?? null,
    status: extras.status,
    meta_template_id: extras.metaTemplateId,
    submission_error: extras.submissionError,
    rejection_reason: null,
    last_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireWorkspacePermission('manage_local_templates')
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    let payload: TemplatePayload
    try {
      payload = (await request.json()) as TemplatePayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    if (payload.category === 'Authentication') {
      return NextResponse.json(
        {
          error:
            'AUTHENTICATION templates are not yet supported here — create them in Meta WhatsApp Manager and use "Sync from Meta".',
        },
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

    const admin = supabaseAdmin()
    const dryRun =
      process.env.WHATSAPP_TEMPLATES_DRY_RUN === 'true' ||
      process.env.WHATSAPP_TEMPLATES_DRY_RUN === '1'

    let metaTemplateId: string
    let metaStatus: string

    if (dryRun) {
      metaTemplateId = `dry-run-${crypto.randomUUID()}`
      metaStatus = 'PENDING'
    } else {
      const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
        waba_id?: string | null
        access_token: string
      }>({
        workspaceId: guard.workspace.workspaceId,
        columns: '*',
      })

      if (configError || !config) {
        return NextResponse.json(
          {
            error:
              'WhatsApp not configured. Connect your WhatsApp Business account in Settings first.',
          },
          { status: 400 },
        )
      }
      if (!config.waba_id) {
        return NextResponse.json(
          {
            error:
              'WABA (WhatsApp Business Account) ID missing. Re-connect your account in Settings.',
          },
          { status: 400 },
        )
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
        const meta = await submitMessageTemplate({
          wabaId: config.waba_id,
          accessToken,
          payload: buildMetaTemplatePayload(payload),
        })
        metaTemplateId = meta.id
        metaStatus = meta.status
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meta submit failed.'
        await admin.from('message_templates').upsert(
          buildTemplateRow(guard.workspace.workspaceId, guard.workspace.userId, payload, {
            status: 'DRAFT',
            metaTemplateId: null,
            submissionError: message,
          }),
          { onConflict: 'workspace_id,name,language' },
        )
        const isRateLimit = /\b429\b/.test(message)
        return NextResponse.json(
          {
            error: isRateLimit
              ? 'Meta rate limit hit (100 template creates per hour). Try again later.'
              : message,
          },
          { status: isRateLimit ? 429 : 502 },
        )
      }
    }

    const { data: row, error: upsertError } = await admin
      .from('message_templates')
      .upsert(
        buildTemplateRow(guard.workspace.workspaceId, guard.workspace.userId, payload, {
          status: normalizeStatus(metaStatus),
          metaTemplateId,
          submissionError: null,
        }),
        { onConflict: 'workspace_id,name,language' },
      )
      .select()
      .single()

    if (upsertError) {
      return NextResponse.json(
        {
          error: `Submitted to Meta but failed to save locally: ${upsertError.message}. Run "Sync from Meta" to recover.`,
          meta_template_id: metaTemplateId,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, template: row, dry_run: dryRun })
  } catch (error) {
    console.error('Error submitting template:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit template.' },
      { status: 500 },
    )
  }
}
