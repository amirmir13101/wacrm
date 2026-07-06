import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import {
  isRecipientNotAllowedError,
  isValidE164,
  phoneVariants,
  sanitizePhoneForMeta,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  classifyBroadcastFailure,
  getRetryableRecipients,
  resolveBroadcastVariables,
  type BroadcastFailureType,
} from '@/lib/broadcast-retry'
import type { Broadcast, BroadcastRecipient, Contact, VariableMapping } from '@/types'
import { requireWorkspacePermission } from '@/lib/team/server'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'

const RETRY_BATCH_SIZE = 10
const RETRY_BATCH_DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface RouteContext {
  params: Promise<{ id: string }>
}

type RecipientWithContact = BroadcastRecipient & {
  contact: Contact | null
}

type CustomValueIndex = Map<string, Map<string, string>>

async function fetchCustomValueIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactIds: string[],
): Promise<CustomValueIndex> {
  const index: CustomValueIndex = new Map()
  if (contactIds.length === 0) return index

  const PAGE = 500
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE)
    const { data } = await supabase
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice)

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>()
      bucket.set(row.custom_field_id, row.value ?? '')
      index.set(row.contact_id, bucket)
    }
  }

  return index
}

async function sendWithVariants(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language: string
  params: string[]
}): Promise<{ messageId: string }> {
  const sanitized = sanitizePhoneForMeta(args.to)
  if (!isValidE164(sanitized)) {
    throw new Error('Invalid phone number format')
  }

  let lastError: string | null = null
  for (const variant of phoneVariants(sanitized)) {
    try {
      return await sendTemplateMessage({
        phoneNumberId: args.phoneNumberId,
        accessToken: args.accessToken,
        to: variant,
        templateName: args.templateName,
        language: args.language,
        params: args.params,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      lastError = errorMessage
      if (!isRecipientNotAllowedError(errorMessage)) break
    }
  }

  throw new Error(lastError ?? 'Unknown error')
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: broadcastId } = await context.params
    const supabase = await createClient()

    const workspaceResult = await requireWorkspacePermission('queue_broadcasts')
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }
    const workspaceId = workspaceResult.workspace.workspaceId

    const limit = checkRateLimit(
      `broadcast-retry:${workspaceId}:${workspaceResult.workspace.userId}`,
      RATE_LIMITS.broadcast,
    )
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('workspace_id', workspaceId)
      .single()

    if (broadcastError || !broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    const typedBroadcast = broadcast as Broadcast
    if (typedBroadcast.status === 'sending') {
      return NextResponse.json(
        { error: 'Cannot retry while this broadcast is actively sending.' },
        { status: 400 },
      )
    }

    const language = typedBroadcast.template_language || 'en_US'
    const { data: approvedTemplate, error: templateError } = await supabase
      .from('message_templates')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', typedBroadcast.template_name)
      .eq('language', language)
      .eq('status', 'Approved')
      .maybeSingle()

    if (templateError) {
      return NextResponse.json(
        { error: 'Failed to verify template approval status' },
        { status: 500 },
      )
    }

    if (!approvedTemplate) {
      return NextResponse.json(
        { error: 'Retry blocked because the original template is not Approved.' },
        { status: 400 },
      )
    }

    const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
      phone_number_id: string
      access_token: string
      status: string
    }>({
      workspaceId,
      columns: 'phone_number_id, access_token, status',
    })

    if (configError || !config || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp is not connected. Please reconnect it in Settings.' },
        { status: 400 },
      )
    }

    const { data: failedRecipients, error: recipientsError } = await supabase
      .from('broadcast_recipients')
      .select('*, contact:contacts(*)')
      .eq('broadcast_id', broadcastId)
      .eq('status', 'failed')
      .order('created_at', { ascending: true })

    if (recipientsError) {
      return NextResponse.json(
        { error: `Failed to load failed recipients: ${recipientsError.message}` },
        { status: 500 },
      )
    }

    const { retryable, skipped } = getRetryableRecipients(
      ((failedRecipients ?? []) as RecipientWithContact[]).map((recipient) => ({
        ...recipient,
        status: recipient.status,
      })),
    )

    const accessToken = decrypt(config.access_token)
    const contactIds = retryable
      .map((recipient) => recipient.contact?.id)
      .filter((id): id is string => Boolean(id))
    const customValueIndex = await fetchCustomValueIndex(supabase, contactIds)

    let retried = 0
    let success = 0
    let failedAgain = 0

    for (let i = 0; i < retryable.length; i += RETRY_BATCH_SIZE) {
      const batch = retryable.slice(i, i + RETRY_BATCH_SIZE)

      for (const recipient of batch) {
        const now = new Date().toISOString()
        const contact = recipient.contact
        if (!contact?.phone) continue

        retried++
        try {
          const result = await sendWithVariants({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: contact.phone,
            templateName: typedBroadcast.template_name,
            language,
            params: resolveBroadcastVariables(
              typedBroadcast.template_variables as Record<string, VariableMapping>,
              contact,
              customValueIndex.get(contact.id),
            ),
          })

          const { error: updateError } = await supabase
            .from('broadcast_recipients')
            .update({
              status: 'sent',
              sent_at: now,
              delivered_at: null,
              read_at: null,
              replied_at: null,
              error_message: null,
              last_error_message: null,
              failure_type: null,
              whatsapp_message_id: result.messageId,
              retry_count: (recipient.retry_count ?? 0) + 1,
              last_retry_at: now,
            })
            .eq('id', recipient.id)
            .eq('status', 'failed')

          if (updateError) throw updateError
          success++
        } catch (error) {
          failedAgain++
          const message = error instanceof Error ? error.message : 'Unknown error'
          const failureType: BroadcastFailureType = classifyBroadcastFailure(message)
          await supabase
            .from('broadcast_recipients')
            .update({
              status: 'failed',
              error_message: message,
              last_error_message: message,
              failure_type: failureType,
              retry_count: (recipient.retry_count ?? 0) + 1,
              last_retry_at: now,
            })
            .eq('id', recipient.id)
            .eq('status', 'failed')
        }
      }

      if (i + RETRY_BATCH_SIZE < retryable.length) {
        await sleep(RETRY_BATCH_DELAY_MS)
      }
    }

    if (retried > 0) {
      const { count: remainingFailed } = await supabase
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', broadcastId)
        .eq('status', 'failed')

      await supabase
        .from('broadcasts')
        .update({
          status: remainingFailed && remainingFailed > 0 ? 'failed' : 'sent',
        })
        .eq('id', broadcastId)
        .eq('workspace_id', workspaceId)
    }

    return NextResponse.json({
      success: true,
      retried,
      success_count: success,
      failed_again_count: failedAgain,
      skipped_count: skipped.length,
      skipped,
    })
  } catch (error) {
    console.error('Error retrying broadcast recipients:', error)
    return NextResponse.json(
      { error: 'Failed to retry failed recipients' },
      { status: 500 },
    )
  }
}
