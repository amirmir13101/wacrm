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
import {
  releaseWorkspaceBroadcastUsage,
  reserveWorkspaceBroadcastUsage,
} from '@/lib/billing/trial'
import type { Contact, MessageTemplate, VariableMapping, WhatsAppPricingRate } from '@/types'

interface IncomingRecipient {
  phone: string
  params?: string[]
  name?: string
}

type AudienceConfig = {
  type: 'all' | 'tags' | 'custom_field' | 'csv' | 'api'
  tagIds?: string[]
  customField?: {
    fieldId: string
    operator: 'is' | 'is_not' | 'contains'
    value: string
  }
  csvContacts?: { phone: string; name?: string }[]
  excludeTagIds?: string[]
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
    query = query
      .eq('name', args.templateName)
      .eq('language', args.language || 'en_US')
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
    let templateLanguage = (body.template_language as string | undefined) ?? 'en_US'

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
    templateName = template.name
    templateLanguage = template.language ?? 'en_US'

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
    const usageReservation = await reserveWorkspaceBroadcastUsage({
      workspaceId: workspace.workspaceId,
      count: eligibleContacts.length,
    })

    if (!usageReservation.allowed) {
      return NextResponse.json(
        {
          error: usageReservation.message,
          preflight,
          trial: usageReservation.result,
        },
        { status: 402 },
      )
    }

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
      await releaseWorkspaceBroadcastUsage({
        workspaceId: workspace.workspaceId,
        count: usageReservation.reserved,
      })
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
