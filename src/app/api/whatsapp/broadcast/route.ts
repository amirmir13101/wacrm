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
import type { Contact, VariableMapping } from '@/types'

interface IncomingRecipient {
  phone: string
  params?: string[]
  name?: string
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

async function findOrCreateContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recipients: IncomingRecipient[],
): Promise<Contact[]> {
  const normalizedByPhone = new Map<string, IncomingRecipient>()
  for (const recipient of recipients) {
    const normalized = normalizeWhatsAppPhone(recipient.phone).phone
    normalizedByPhone.set(normalized, { ...recipient, phone: normalized })
  }

  const { data: existing, error: lookupError } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (lookupError) throw new Error(`Failed to look up contacts: ${lookupError.message}`)

  const byPhone = new Map<string, Contact>()
  for (const contact of (existing ?? []) as Contact[]) {
    if (contact.phone) byPhone.set(normalizePhoneForComparison(contact.phone), contact)
  }

  const missing = [...normalizedByPhone.entries()]
    .filter(([phone]) => !byPhone.has(phone))
    .map(([phone, recipient]) => ({
      user_id: userId,
      phone,
      name: recipient.name?.trim() || null,
      whatsapp_opt_in: false,
    }))

  for (let i = 0; i < missing.length; i += 200) {
    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .insert(missing.slice(i, i + 200))
      .select('*')

    if (insertError) throw new Error(`Failed to create contacts: ${insertError.message}`)
    for (const contact of (inserted ?? []) as Contact[]) {
      if (contact.phone) byPhone.set(normalizePhoneForComparison(contact.phone), contact)
    }
  }

  return [...normalizedByPhone.keys()]
    .map((phone) => byPhone.get(phone))
    .filter((contact): contact is Contact => Boolean(contact))
}

/**
 * Compatibility endpoint for older callers.
 *
 * This route used to send every WhatsApp broadcast message immediately from
 * the API request. Production bulk sending must go through the server-side
 * queue, so this endpoint now creates the broadcast + pending recipient rows
 * and lets /api/whatsapp/broadcast/worker perform delivery.
 */
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
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
      name,
    } = body

    let recipients: IncomingRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params) ? template_params : []
      recipients = phone_numbers.map((phone: string) => ({ phone, params: shared }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` or `phone_numbers`; it must be a non-empty array.',
        },
        { status: 400 },
      )
    }

    if (!template_name) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 })
    }

    const language = template_language || 'en_US'
    const { data: approvedTemplate, error: templateError } = await supabase
      .from('message_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', template_name)
      .eq('language', language)
      .eq('status', 'Approved')
      .maybeSingle()

    if (templateError) {
      console.error('Error checking broadcast template approval:', templateError)
      return NextResponse.json(
        { error: 'Failed to verify template approval status' },
        { status: 500 },
      )
    }

    if (!approvedTemplate) {
      return NextResponse.json(
        {
          error:
            'Only approved Meta templates can be used for broadcasts. Sync approved templates from Settings and try again.',
        },
        { status: 400 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (configError || !config || config.status !== 'connected') {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 },
      )
    }

    let variables: Record<string, VariableMapping>
    try {
      variables = sharedStaticVariables(recipients)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid template parameters' },
        { status: 400 },
      )
    }

    const contacts = await findOrCreateContacts(supabase, user.id, recipients)
    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found.' }, { status: 400 })
    }

    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        user_id: user.id,
        name: name?.trim() || `Queued broadcast - ${new Date().toLocaleString()}`,
        template_name,
        template_language: language,
        template_variables: variables,
        audience_filter: { type: 'api' },
        status: 'queued',
        total_recipients: contacts.length,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        replied_count: 0,
        failed_count: 0,
        skipped_count: 0,
      })
      .select('id')
      .single()

    if (broadcastError || !broadcast) {
      throw new Error(`Failed to create broadcast: ${broadcastError?.message ?? 'unknown error'}`)
    }

    for (let i = 0; i < contacts.length; i += 200) {
      const { error: recipientsError } = await supabase
        .from('broadcast_recipients')
        .insert(
          contacts.slice(i, i + 200).map((contact) => ({
            broadcast_id: broadcast.id,
            contact_id: contact.id,
            status: 'pending',
          })),
        )

      if (recipientsError) {
        await supabase
          .from('broadcasts')
          .update({ status: 'failed', queue_error: recipientsError.message })
          .eq('id', broadcast.id)
        throw new Error(`Failed to queue recipients: ${recipientsError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      queued: true,
      broadcast_id: broadcast.id,
      total: contacts.length,
      message:
        'Broadcast queued. Delivery will be handled by the server-side broadcast worker.',
    })
  } catch (error) {
    console.error('Error queueing WhatsApp broadcast:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue broadcast' },
      { status: 500 },
    )
  }
}
