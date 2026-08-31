import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  normalizePhoneForComparison,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  buildBroadcastPreflightSummary,
  evaluateBroadcastRecipients,
} from '@/lib/broadcast-preflight'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { dedupeSharedPricingRates } from '@/lib/whatsapp/pricing-rates'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import type { Broadcast, Contact, MessageTemplate, VariableMapping, WhatsAppPricingRate } from '@/types'
import { isApprovedTemplateStatus } from '@/lib/whatsapp/template-status-normalize'
import { decrypt } from '@/lib/whatsapp/encryption'

const META_API_BASE = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v21.0'}`

interface IncomingRecipient {
  phone: string
  params?: string[]
  name?: string
}

type AudienceConfig = {
  type: 'all' | 'contact_list' | 'tags' | 'custom_field' | 'csv' | 'api'
  contactListId?: string
  contactListName?: string
  tagIds?: string[]
  customField?: {
    fieldId: string
    operator: 'is' | 'is_not' | 'contains'
    value: string
  }
  csvContacts?: { phone: string; name?: string }[]
  excludeTagIds?: string[]
}

const ACTIVE_BROADCAST_DELETE_STATUSES = new Set(['queued', 'sending'])

function readBroadcastIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]
}

export function sameParams(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function sharedStaticVariables(
  recipients: IncomingRecipient[],
): Record<string, VariableMapping> {
  const first = recipients[0]?.params ?? []
  const hasPerRecipientParams = recipients.some(
    (recipient) => !sameParams(recipient.params ?? [], first),
  )

  if (hasPerRecipientParams) {
    throw new Error(
      'Queued broadcasts do not support different raw template_params per phone number. Use the Broadcasts UI with contact fields/custom fields for personalization.',
    )
  }

  return first.reduce<Record<string, VariableMapping>>((acc, value, index) => {
    acc[String(index + 1)] = { type: 'static', value }
    return acc
  }, {})
}

async function fetchApprovedOrSelectedTemplate(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  workspaceId: string
  templateId?: string
  templateName?: string
  language?: string
}) {
  let query = args.supabase
    .from('message_templates')
    .select('*')
    .eq('workspace_id', args.workspaceId)

  if (args.templateId) {
    query = query.eq('id', args.templateId)
  } else if (args.templateName) {
    if (!args.language) {
      throw new Error('Choose the exact language for this template before queueing a broadcast.')
    }
    query = query
      .eq('name', args.templateName)
      .eq('language', args.language)
  } else {
    throw new Error('template_id or template_name is required')
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(`Failed to verify template: ${error.message}`)
  return data as MessageTemplate | null
}

async function fetchWhatsAppConnected(args: {
  workspaceId: string
}) {
  const { config: data, error } = await findWorkspaceWhatsAppConfig<{ id: string; status: string }>({
    workspaceId: args.workspaceId,
    columns: 'id, status',
  })
  if (error) throw new Error(`Failed to check WhatsApp connection: ${error}`)
  return data?.status === 'connected'
}

async function verifyTemplateExistsInConnectedMeta(args: {
  workspaceId: string
  templateName: string
  language: string
}) {
  const { config, error } = await findWorkspaceWhatsAppConfig<{
    waba_id?: string | null
    access_token: string
    status: string
  }>({
    workspaceId: args.workspaceId,
    columns: 'phone_number_id, waba_id, access_token, status',
  })

  if (error || !config || config.status !== 'connected') {
    return {
      ok: false,
      error: 'WhatsApp is not connected. Please configure WhatsApp in Settings.',
    }
  }

  if (!config.waba_id) {
    return {
      ok: false,
      error: 'WABA (WhatsApp Business Account) ID missing. Re-connect WhatsApp in Settings.',
    }
  }

  const response = await fetch(
    `${META_API_BASE}/${config.waba_id}/message_templates?limit=100&fields=id,name,language,status`,
    {
      headers: { Authorization: `Bearer ${decrypt(config.access_token)}` },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    return {
      ok: false,
      error: 'Could not verify templates with Meta. Please sync templates and try again.',
    }
  }

  const body = (await response.json()) as {
    data?: Array<{ name?: string; language?: string; status?: string }>
  }

  const exact = (body.data ?? []).find(
    (template) =>
      template.name === args.templateName &&
      template.language === args.language &&
      isApprovedTemplateStatus(template.status),
  )

  if (!exact) {
    return {
      ok: false,
      error:
        'This template/language is not available in Meta anymore. Please sync templates and select an approved template again.',
    }
  }

  return { ok: true, error: null }
}

async function fetchPricingRates() {
  const { data, error } = await supabaseAdmin()
    .from('whatsapp_pricing_rates')
    .select('*')

  if (error) throw new Error(`Failed to load pricing rates: ${error.message}`)
  return dedupeSharedPricingRates((data ?? []) as WhatsAppPricingRate[])
}

async function upsertCsvContactsForQueue(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
  rows: { phone: string; name?: string }[]
}) {
  const normalizedByPhone = new Map<string, { phone: string; name?: string }>()
  for (const row of args.rows) {
    try {
      const phone = normalizeWhatsAppPhone(row.phone).phone
      normalizedByPhone.set(phone, { ...row, phone })
    } catch {
      // Invalid rows are counted in preflight from the temporary contact below.
    }
  }

  const { data: existing, error: lookupError } = await args.supabase
    .from('contacts')
    .select('*')
    .eq('workspace_id', args.workspaceId)
  if (lookupError) throw new Error(`Failed to look up CSV contacts: ${lookupError.message}`)

  const byPhone = new Map<string, Contact>()
  for (const contact of (existing ?? []) as Contact[]) {
    if (contact.phone) byPhone.set(normalizePhoneForComparison(contact.phone), contact)
  }

  const missing = [...normalizedByPhone.entries()]
    .filter(([phone]) => !byPhone.has(phone))
    .map(([phone, row]) => ({
      user_id: args.userId,
      workspace_id: args.workspaceId,
      phone,
      name: row.name?.trim() || null,
      whatsapp_opt_in: false,
    }))

  for (let i = 0; i < missing.length; i += 200) {
    const { data: inserted, error } = await args.supabase
      .from('contacts')
      .insert(missing.slice(i, i + 200))
      .select('*')
    if (error) throw new Error(`Failed to create CSV contacts: ${error.message}`)
    for (const contact of (inserted ?? []) as Contact[]) {
      if (contact.phone) byPhone.set(normalizePhoneForComparison(contact.phone), contact)
    }
  }

  return [...normalizedByPhone.keys()]
    .map((phone) => byPhone.get(phone))
    .filter((contact): contact is Contact => Boolean(contact))
}

async function resolveAudience(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
  audience: AudienceConfig
  createCsvContacts: boolean
}) {
  let contacts: Contact[] = []

  if (args.audience.type === 'all') {
    const { data, error } = await args.supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', args.workspaceId)
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
    contacts = (data ?? []) as Contact[]
  } else if (args.audience.type === 'contact_list' && args.audience.contactListId) {
    const { data: list, error: listError } = await args.supabase
      .from('contact_lists')
      .select('id, name')
      .eq('workspace_id', args.workspaceId)
      .eq('id', args.audience.contactListId)
      .maybeSingle()
    if (listError) throw new Error(`Failed to verify contact list: ${listError.message}`)
    if (!list) throw new Error('Selected contact list was not found in this workspace.')
    args.audience.contactListName = list.name

    const { data, error } = await args.supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', args.workspaceId)
      .eq('contact_list_id', args.audience.contactListId)
    if (error) throw new Error(`Failed to fetch contact list recipients: ${error.message}`)
    contacts = (data ?? []) as Contact[]
  } else if (args.audience.type === 'contact_list') {
    throw new Error('Choose a contact list before continuing.')
  } else if (args.audience.type === 'tags' && args.audience.tagIds?.length) {
    const { data, error } = await args.supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', args.audience.tagIds)
    if (error) throw new Error(`Failed to fetch contact tags: ${error.message}`)
    const ids = [...new Set((data ?? []).map((row) => row.contact_id))]
    if (ids.length > 0) {
      const { data: contactRows, error: contactError } = await args.supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', args.workspaceId)
        .in('id', ids)
      if (contactError) throw new Error(`Failed to fetch contacts: ${contactError.message}`)
      contacts = (contactRows ?? []) as Contact[]
    }
  } else if (args.audience.type === 'custom_field' && args.audience.customField) {
    const { fieldId, operator, value } = args.audience.customField
    let query = args.supabase
      .from('contact_custom_values')
      .select('contact_id')
      .eq('custom_field_id', fieldId)
    if (operator === 'is') query = query.eq('value', value)
    else if (operator === 'is_not') query = query.neq('value', value)
    else query = query.ilike('value', `%${value}%`)

    const { data, error } = await query
    if (error) throw new Error(`Custom-field filter failed: ${error.message}`)
    const ids = [...new Set((data ?? []).map((row) => row.contact_id))]
    if (ids.length > 0) {
      const { data: contactRows, error: contactError } = await args.supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', args.workspaceId)
        .in('id', ids)
      if (contactError) throw new Error(`Failed to fetch contacts: ${contactError.message}`)
      contacts = (contactRows ?? []) as Contact[]
    }
  } else if (args.audience.type === 'csv' && args.audience.csvContacts?.length) {
    if (args.createCsvContacts) {
      contacts = await upsertCsvContactsForQueue({
        supabase: args.supabase,
        userId: args.userId,
        workspaceId: args.workspaceId,
        rows: args.audience.csvContacts,
      })
    } else {
      contacts = args.audience.csvContacts.map((row, index) => {
        let phone = row.phone
        try {
          phone = normalizeWhatsAppPhone(row.phone).phone
        } catch {
          // Keep the raw value so preflight can count it as invalid.
        }
        return {
          id: `csv-${index}`,
          user_id: args.userId,
          workspace_id: args.workspaceId,
          phone,
          name: row.name,
          whatsapp_opt_in: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Contact
      })
    }
  }

  if (args.audience.excludeTagIds?.length && contacts.length > 0) {
    const { data } = await args.supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', args.audience.excludeTagIds)
    const excluded = new Set((data ?? []).map((row) => row.contact_id))
    contacts = contacts.filter((contact) => !excluded.has(contact.id))
  }

  return contacts
}

function legacyAudienceFromRecipients(recipients: IncomingRecipient[]): AudienceConfig {
  return {
    type: 'csv',
    csvContacts: recipients.map((recipient) => ({
      phone: recipient.phone,
      name: recipient.name,
    })),
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json()
    const mode = body.mode === 'preflight' ? 'preflight' : 'queue'
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }
    const workspace = workspaceResult.workspace
    const permissionSubject = {
      role: workspace.role,
      permissions: workspace.permissions,
      can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
    }
    const requiredPermission = mode === 'preflight' ? 'create_broadcasts' : 'queue_broadcasts'
    if (!hasWorkspacePermission(permissionSubject, requiredPermission)) {
      return NextResponse.json({ error: 'Permission required' }, { status: 403 })
    }

    let audience: AudienceConfig | null = body.audience ?? null
    let variables: Record<string, VariableMapping> = body.variables ?? {}
    let templateName = body.template_name as string | undefined
    let templateLanguage = body.template_language as string | undefined

    if (!audience) {
      const recipients = Array.isArray(body.recipients)
        ? (body.recipients as IncomingRecipient[])
        : Array.isArray(body.phone_numbers)
          ? (body.phone_numbers as string[]).map((phone) => ({
              phone,
              params: Array.isArray(body.template_params) ? body.template_params : [],
            }))
          : []

      if (recipients.length === 0) {
        return NextResponse.json({ error: 'No recipients or audience provided.' }, { status: 400 })
      }
      audience = legacyAudienceFromRecipients(recipients)
      variables = sharedStaticVariables(recipients)
    }

    const template = await fetchApprovedOrSelectedTemplate({
      supabase,
      workspaceId: workspace.workspaceId,
      templateId: body.template_id,
      templateName,
      language: templateLanguage,
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 400 })
    }
    if (!isApprovedTemplateStatus(String(template.status ?? ''))) {
      return NextResponse.json(
        { error: 'Selected template is not approved. Please sync templates and select an approved template.' },
        { status: 400 },
      )
    }
    if (!template.language) {
      return NextResponse.json(
        {
          error:
            'Selected template has no approved language. Please re-sync templates and select an approved template.',
        },
        { status: 400 },
      )
    }
    templateName = template.name
    templateLanguage = template.language

    const metaTemplateCheck = await verifyTemplateExistsInConnectedMeta({
      workspaceId: workspace.workspaceId,
      templateName,
      language: templateLanguage,
    })
    if (!metaTemplateCheck.ok) {
      return NextResponse.json({ error: metaTemplateCheck.error }, { status: 400 })
    }

    const [whatsappConnected, rates, contacts] = await Promise.all([
      fetchWhatsAppConnected({ workspaceId: workspace.workspaceId }),
      fetchPricingRates(),
      resolveAudience({
        supabase,
        userId: user.id,
        workspaceId: workspace.workspaceId,
        audience,
        createCsvContacts: mode === 'queue',
      }),
    ])

    const preflight = buildBroadcastPreflightSummary({
      whatsappConnected,
      template,
      contacts,
      rates,
    })

    if (mode === 'preflight') {
      return NextResponse.json({ success: true, preflight })
    }

    if (preflight.blockers.length > 0) {
      return NextResponse.json({ error: preflight.blockers[0], preflight }, { status: 400 })
    }
    if (preflight.pricingMissingCount > 0 && body.acknowledge_missing_pricing !== true) {
      return NextResponse.json(
        {
          error: 'Pricing is missing for some recipients. Please acknowledge before queueing.',
          preflight,
        },
        { status: 400 },
      )
    }
    if (body.acknowledge_billing !== true) {
      return NextResponse.json(
        {
          error: 'Please confirm recipients are opted in and you understand this is an estimated cost.',
          preflight,
        },
        { status: 400 },
      )
    }

    const recipientResult = evaluateBroadcastRecipients(contacts)
    const eligibleContacts = recipientResult.eligible.map((recipient) => recipient.contact)

    let broadcast: { id: string } | null = null
    try {
      const { data: createdBroadcast, error: broadcastError } = await supabase
        .from('broadcasts')
        .insert({
          user_id: user.id,
          workspace_id: workspace.workspaceId,
          name: body.name?.trim() || `Queued broadcast - ${new Date().toLocaleString()}`,
          template_name: templateName,
          template_language: templateLanguage,
          template_variables: variables,
          audience_filter: audience,
          status: 'queued',
          total_recipients: eligibleContacts.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
          skipped_count: 0,
          preflight_total_selected: preflight.totalSelected,
          preflight_eligible_count: preflight.eligibleCount,
          preflight_skipped_not_opted_in: preflight.skippedNotOptedIn,
          preflight_skipped_opted_out: preflight.skippedOptedOut,
          preflight_skipped_invalid_phone: preflight.skippedInvalidPhone,
          preflight_skipped_duplicate_phone: preflight.skippedDuplicatePhone,
          estimated_cost_summary: {
            pricingBreakdown: preflight.pricingBreakdown,
            currencyTotals: preflight.currencyTotals,
            missingPricingWarnings: preflight.missingPricingWarnings,
          },
          pricing_missing_count: preflight.pricingMissingCount,
          preflight_acknowledged_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      broadcast = createdBroadcast as { id: string } | null

      if (broadcastError || !broadcast) {
        throw new Error(`Failed to create broadcast: ${broadcastError?.message ?? 'unknown error'}`)
      }

      const broadcastId = broadcast.id
      for (let i = 0; i < eligibleContacts.length; i += 200) {
        const { error } = await supabase
          .from('broadcast_recipients')
          .insert(
            eligibleContacts.slice(i, i + 200).map((contact) => ({
              broadcast_id: broadcastId,
              contact_id: contact.id,
              status: 'pending',
            })),
          )

        if (error) {
          await supabase
            .from('broadcasts')
            .update({ status: 'failed', queue_error: error.message })
            .eq('id', broadcastId)
          throw new Error(`Failed to queue recipients: ${error.message}`)
        }
      }
    } catch (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      queued: true,
      broadcast_id: broadcast.id,
      total: eligibleContacts.length,
      preflight,
      message: 'Broadcast queued. Delivery will be handled by the server-side broadcast worker.',
    })
  } catch (error) {
    console.error('Error queueing WhatsApp broadcast:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue broadcast' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }

    const workspace = workspaceResult.workspace
    const permissionSubject = {
      role: workspace.role,
      permissions: workspace.permissions,
      can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
    }

    if (!hasWorkspacePermission(permissionSubject, 'pause_resume_cancel_broadcasts')) {
      return NextResponse.json({ error: 'Permission required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const ids = readBroadcastIds(body.ids)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one broadcast to delete.' }, { status: 400 })
    }

    const supabase = supabaseAdmin()
    const { data: broadcasts, error: fetchError } = await supabase
      .from('broadcasts')
      .select('id, status')
      .eq('workspace_id', workspace.workspaceId)
      .in('id', ids)

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const found = (broadcasts ?? []) as Pick<Broadcast, 'id' | 'status'>[]
    const deletableIds = found
      .filter((broadcast) => !ACTIVE_BROADCAST_DELETE_STATUSES.has(broadcast.status))
      .map((broadcast) => broadcast.id)
    const blockedIds = found
      .filter((broadcast) => ACTIVE_BROADCAST_DELETE_STATUSES.has(broadcast.status))
      .map((broadcast) => broadcast.id)
    const notFoundIds = ids.filter((id) => !found.some((broadcast) => broadcast.id === id))

    if (deletableIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('broadcasts')
        .delete()
        .eq('workspace_id', workspace.workspaceId)
        .in('id', deletableIds)

      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deletedCount: deletableIds.length,
      skippedCount: blockedIds.length + notFoundIds.length,
      blockedIds,
      notFoundIds,
      message:
        blockedIds.length > 0
          ? 'Some broadcasts were not deleted because they are queued or sending.'
          : 'Selected broadcasts deleted.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete broadcasts.' },
      { status: 500 },
    )
  }
}
