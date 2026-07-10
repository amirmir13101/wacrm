import { NextResponse } from 'next/server'

import type { TemplateButton, TemplateSampleValues } from '@/types'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import { decrypt } from '@/lib/whatsapp/encryption'
import { normalizeStatus } from '@/lib/whatsapp/template-status-normalize'

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

interface MetaButton {
  type: string
  text: string
  url?: string
  phone_number?: string
  example?: string[] | string
}

interface MetaTemplateComponent {
  type: string
  text?: string
  format?: string
  buttons?: MetaButton[]
  example?: {
    header_text?: string[]
    header_handle?: string[]
    body_text?: string[][]
  }
}

interface MetaTemplate {
  id: string
  name: string
  language: string
  status: string
  category: string
  components?: MetaTemplateComponent[]
  quality_score?: { score?: string } | string
}

function normalizeCategory(meta: string): 'Marketing' | 'Utility' | 'Authentication' {
  const upper = meta.toUpperCase()
  if (upper === 'UTILITY') return 'Utility'
  if (upper === 'AUTHENTICATION') return 'Authentication'
  return 'Marketing'
}

function normalizeQualityScore(raw: MetaTemplate['quality_score']): 'GREEN' | 'YELLOW' | 'RED' | null {
  const score = typeof raw === 'string' ? raw : raw?.score ? String(raw.score) : null
  if (!score) return null
  const upper = score.toUpperCase()
  return upper === 'GREEN' || upper === 'YELLOW' || upper === 'RED'
    ? (upper as 'GREEN' | 'YELLOW' | 'RED')
    : null
}

function parseButtons(metaButtons: MetaButton[] | undefined): TemplateButton[] {
  if (!metaButtons?.length) return []
  const out: TemplateButton[] = []
  for (const button of metaButtons) {
    switch (button.type?.toUpperCase()) {
      case 'QUICK_REPLY':
        out.push({ type: 'QUICK_REPLY', text: button.text })
        break
      case 'URL':
        out.push({
          type: 'URL',
          text: button.text,
          url: button.url ?? '',
          example: Array.isArray(button.example) ? button.example[0] : button.example,
        })
        break
      case 'PHONE_NUMBER':
        out.push({
          type: 'PHONE_NUMBER',
          text: button.text,
          phone_number: button.phone_number ?? '',
        })
        break
      case 'COPY_CODE':
        out.push({
          type: 'COPY_CODE',
          text: button.text,
          example: Array.isArray(button.example)
            ? button.example[0] ?? ''
            : button.example ?? '',
        })
        break
    }
  }
  return out
}

function extractSampleValues(
  body: MetaTemplateComponent | undefined,
  header: MetaTemplateComponent | undefined,
): TemplateSampleValues | null {
  const bodySample = body?.example?.body_text?.[0]
  const headerSample = header?.example?.header_text
  if (!bodySample?.length && !headerSample?.length) return null
  const sampleValues: TemplateSampleValues = {}
  if (bodySample?.length) sampleValues.body = bodySample
  if (headerSample?.length) sampleValues.header = headerSample
  return sampleValues
}

export async function POST() {
  try {
    const guard = await requireWorkspacePermission('sync_templates')
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

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
    const metaTemplates: MetaTemplate[] = []
    let nextUrl: string | null =
      `${META_API_BASE}/${config.waba_id}/message_templates?limit=100&fields=id,name,language,status,category,components,quality_score`
    const PAGE_CAP = 20
    let pageCount = 0

    while (nextUrl && pageCount < PAGE_CAP) {
      pageCount += 1
      const metaResponse: Response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!metaResponse.ok) {
        let metaError = `Meta API error: ${metaResponse.status}`
        try {
          const body = await metaResponse.json()
          if (body?.error?.message) metaError = body.error.message
        } catch {
          // Keep fallback.
        }
        return NextResponse.json({ error: metaError }, { status: 502 })
      }

      const metaBody = (await metaResponse.json()) as {
        data?: MetaTemplate[]
        paging?: { next?: string }
      }
      if (metaBody.data) metaTemplates.push(...metaBody.data)
      nextUrl = metaBody.paging?.next ?? null
    }

    const admin = supabaseAdmin()
    let inserted = 0
    let updated = 0
    let markedUnavailable = 0
    const errors: { name: string; language: string; message: string }[] = []
    const currentMetaPairs = new Set(
      metaTemplates.map((template) => `${template.name}\u0000${template.language}`),
    )

    for (const template of metaTemplates) {
      const body = (template.components ?? []).find((component) => component.type === 'BODY')
      const header = (template.components ?? []).find((component) => component.type === 'HEADER')
      const footer = (template.components ?? []).find((component) => component.type === 'FOOTER')
      const buttons = (template.components ?? []).find((component) => component.type === 'BUTTONS')
      const parsedButtons = parseButtons(buttons?.buttons)
      const sampleValues = extractSampleValues(body, header)
      const headerFormat = header?.format?.toUpperCase()
      const headerType =
        headerFormat === 'TEXT' ||
        headerFormat === 'IMAGE' ||
        headerFormat === 'VIDEO' ||
        headerFormat === 'DOCUMENT'
          ? headerFormat.toLowerCase()
          : null

      const row = {
        workspace_id: guard.workspace.workspaceId,
        user_id: guard.workspace.userId,
        name: template.name,
        category: normalizeCategory(template.category),
        language: template.language,
        header_type: headerType,
        header_content: header?.text ?? null,
        header_handle: header?.example?.header_handle?.[0] ?? null,
        body_text: body?.text ?? '',
        footer_text: footer?.text ?? null,
        buttons: parsedButtons.length ? parsedButtons : null,
        sample_values: sampleValues,
        status: normalizeStatus(template.status),
        meta_template_id: template.id,
        quality_score: normalizeQualityScore(template.quality_score),
        updated_at: new Date().toISOString(),
      }

      const { data: existing, error: lookupError } = await admin
        .from('message_templates')
        .select('id')
        .eq('workspace_id', guard.workspace.workspaceId)
        .eq('name', template.name)
        .eq('language', template.language)
        .maybeSingle()

      if (lookupError) {
        errors.push({ name: template.name, language: template.language, message: lookupError.message })
        continue
      }

      if (existing?.id) {
        const { error: updateError } = await admin
          .from('message_templates')
          .update(row)
          .eq('id', existing.id)
          .eq('workspace_id', guard.workspace.workspaceId)
        if (updateError) {
          errors.push({ name: template.name, language: template.language, message: updateError.message })
        } else {
          updated += 1
        }
      } else {
        const { error: insertError } = await admin.from('message_templates').insert(row)
        if (insertError) {
          errors.push({ name: template.name, language: template.language, message: insertError.message })
        } else {
          inserted += 1
        }
      }
    }

    const { data: localMetaTemplates, error: localLookupError } = await admin
      .from('message_templates')
      .select('id, name, language')
      .eq('workspace_id', guard.workspace.workspaceId)
      .not('meta_template_id', 'is', null)

    if (localLookupError) {
      errors.push({
        name: 'local-template-cleanup',
        language: '',
        message: localLookupError.message,
      })
    } else {
      const missingTemplateIds = (localMetaTemplates ?? [])
        .filter((template) => !currentMetaPairs.has(`${template.name}\u0000${template.language}`))
        .map((template) => template.id)

      if (missingTemplateIds.length > 0) {
        const { data: unavailableRows, error: unavailableError } = await admin
          .from('message_templates')
          .update({
            status: 'PENDING_DELETION',
            submission_error:
              'This template/language was not returned by the connected Meta WABA during the latest sync.',
            updated_at: new Date().toISOString(),
          })
          .in('id', missingTemplateIds)
          .select('id')

        if (unavailableError) {
          errors.push({
            name: 'local-template-cleanup',
            language: '',
            message: unavailableError.message,
          })
        } else {
          markedUnavailable = unavailableRows?.length ?? 0
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      total: metaTemplates.length,
      inserted,
      updated,
      marked_unavailable: markedUnavailable,
      errors,
      truncated: pageCount >= PAGE_CAP && nextUrl !== null,
    })
  } catch (error) {
    console.error('Error syncing WhatsApp templates:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync templates' },
      { status: 500 },
    )
  }
}
