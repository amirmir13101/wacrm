import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  BROADCAST_QUEUE_BATCH_SIZE,
  BROADCAST_QUEUE_DELAY_MS,
  finalBroadcastStatus,
  getBroadcastContactEligibility,
  getQueueStatusAction,
  isCronSecretValid,
  sendQueuedTemplateRecipient,
  shouldFinalizeBroadcast,
} from '@/lib/broadcast-queue'
import type { Broadcast, BroadcastRecipient, Contact } from '@/types'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import { APPROVED_TEMPLATE_STATUSES } from '@/lib/whatsapp/template-status-normalize'
import {
  releaseWorkspaceBroadcastUsage,
  reserveWorkspaceBroadcastUsage,
} from '@/lib/billing/trial'
import {
  recordSentBroadcastMessage,
  renderTemplatePreview,
} from '@/lib/inbox/outbound-message'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type RecipientWithContext = BroadcastRecipient & {
  contact: Contact | null
  broadcast: Broadcast
}

type CustomValueIndex = Map<string, Map<string, string>>
type AdminClient = ReturnType<typeof supabaseAdmin>

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function checkCronSecret(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) return 'missing'
  return isCronSecretValid(expected, request.headers.get('x-cron-secret')) ? 'ok' : 'bad'
}

async function fetchCustomValueIndex(contactIds: string[]): Promise<CustomValueIndex> {
  const admin = supabaseAdmin()
  const index: CustomValueIndex = new Map()
  if (contactIds.length === 0) return index

  const PAGE = 500
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const { data } = await admin
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', contactIds.slice(i, i + PAGE))

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>()
      bucket.set(row.custom_field_id, row.value ?? '')
      index.set(row.contact_id, bucket)
    }
  }

  return index
}

async function createWorkerRun(admin: AdminClient, workerId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('broadcast_worker_runs')
    .insert({ worker_id: workerId, status: 'running' })
    .select('id')
    .single()

  if (error) {
    console.warn('[broadcast-worker] failed to create worker run log:', error.message)
    return null
  }
  return data.id
}

async function finishWorkerRun(
  admin: AdminClient,
  runId: string | null,
  args: {
    status: 'completed' | 'failed'
    processed: number
    sent: number
    failed: number
    skipped: number
    error?: string
  },
) {
  if (!runId) return
  const { error } = await admin
    .from('broadcast_worker_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: args.status,
      processed_count: args.processed,
      sent_count: args.sent,
      failed_count: args.failed,
      skipped_count: args.skipped,
      error_message: args.error ?? null,
    })
    .eq('id', runId)

  if (error) {
    console.warn('[broadcast-worker] failed to update worker run log:', error.message)
  }
}

async function fetchFreshBroadcast(
  admin: AdminClient,
  broadcastId: string,
): Promise<Pick<Broadcast, 'id' | 'status'> | null> {
  const { data } = await admin
    .from('broadcasts')
    .select('id, status')
    .eq('id', broadcastId)
    .maybeSingle()
  return data as Pick<Broadcast, 'id' | 'status'> | null
}

async function releaseRecipientToPending(admin: AdminClient, recipientId: string) {
  await admin
    .from('broadcast_recipients')
    .update({ status: 'pending', locked_at: null, locked_by: null })
    .eq('id', recipientId)
}

async function markRecipientFailed(
  admin: AdminClient,
  recipient: Pick<BroadcastRecipient, 'id'>,
  message: string,
) {
  await admin
    .from('broadcast_recipients')
    .update({
      status: 'failed',
      error_message: message,
      last_error_message: message,
      failure_type: 'permanent',
      locked_at: null,
      locked_by: null,
    })
    .eq('id', recipient.id)
}

async function cancelUnsentRecipients(admin: AdminClient, broadcastId: string): Promise<number> {
  const { data } = await admin
    .from('broadcast_recipients')
    .update({
      status: 'skipped',
      skipped_reason: 'Broadcast cancelled before this recipient was sent.',
      locked_at: null,
      locked_by: null,
    })
    .eq('broadcast_id', broadcastId)
    .in('status', ['pending', 'sending'])
    .select('id')

  return data?.length ?? 0
}

async function finalizeBroadcastIfDone(broadcastId: string) {
  const admin = supabaseAdmin()

  const [pendingRes, sendingRes, retryableRes, failedRes, sentLikeRes] = await Promise.all([
    admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending'),
    admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'sending'),
    admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'failed')
      .not('next_retry_at', 'is', null),
    admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'failed'),
    admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .in('status', ['sent', 'delivered', 'read', 'replied']),
  ])

  if (
    shouldFinalizeBroadcast({
      pending: pendingRes.count ?? 0,
      sending: sendingRes.count ?? 0,
      failedRetryable: retryableRes.count ?? 0,
    })
  ) {
    await admin
      .from('broadcasts')
      .update({
        status: finalBroadcastStatus({
          failed: failedRes.count ?? 0,
          sentLike: sentLikeRes.count ?? 0,
          skipped: 0,
        }),
        completed_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)
      .in('status', ['queued', 'sending'])
  }
}

async function processQueue(request: Request) {
  const secret = checkCronSecret(request)
  if (secret === 'missing') {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  if (secret !== 'ok') return unauthorized()

  const admin = supabaseAdmin()
  const lockId = `broadcast-worker-${crypto.randomUUID()}`
  const runId = await createWorkerRun(admin, lockId)
  const batchSize = Number(new URL(request.url).searchParams.get('limit')) || BROADCAST_QUEUE_BATCH_SIZE
  let processed = 0
  let sent = 0
  let failed = 0
  let skipped = 0

  const { data: claimed, error: claimError } = await admin.rpc('claim_broadcast_queue_batch', {
    p_batch_size: Math.min(batchSize, BROADCAST_QUEUE_BATCH_SIZE),
    p_lock_id: lockId,
  })

  if (claimError) {
    await finishWorkerRun(admin, runId, {
      status: 'failed',
      processed,
      sent,
      failed,
      skipped,
      error: claimError.message,
    })
    return NextResponse.json({ error: claimError.message }, { status: 500 })
  }

  const ids = ((claimed ?? []) as Array<{ recipient_id: string }>).map((row) => row.recipient_id)
  if (ids.length === 0) {
    await finishWorkerRun(admin, runId, {
      status: 'completed',
      processed,
      sent,
      failed,
      skipped,
    })
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0 })
  }

  const { data: recipients, error: recipientsError } = await admin
    .from('broadcast_recipients')
    .select('*, contact:contacts(*), broadcast:broadcasts(*)')
    .in('id', ids)
    .eq('locked_by', lockId)

  if (recipientsError) {
    await finishWorkerRun(admin, runId, {
      status: 'failed',
      processed,
      sent,
      failed,
      skipped,
      error: recipientsError.message,
    })
    return NextResponse.json({ error: recipientsError.message }, { status: 500 })
  }

  const rows = (recipients ?? []) as RecipientWithContext[]
  const customValues = await fetchCustomValueIndex(
    rows.map((row) => row.contact?.id).filter((id): id is string => Boolean(id)),
  )

  const configByWorkspace = new Map<string, { phone_number_id: string; access_token: string; status: string }>()
  const approvedTemplateCache = new Map<string, { body_text: string } | null>()
  const touchedBroadcasts = new Set<string>()

  for (const row of rows) {
    touchedBroadcasts.add(row.broadcast_id)
    processed++
    const workspaceId = row.broadcast.workspace_id
    if (!workspaceId) {
      await markRecipientFailed(admin, row, 'Broadcast workspace is missing.')
      failed++
      continue
    }

    const freshBroadcast = await fetchFreshBroadcast(admin, row.broadcast_id)
    const currentStatus = freshBroadcast?.status ?? row.broadcast.status
    const statusAction = getQueueStatusAction(currentStatus)

    if (statusAction === 'pause') {
      await releaseRecipientToPending(admin, row.id)
      skipped++
      continue
    }

    if (statusAction === 'cancel') {
      skipped += await cancelUnsentRecipients(admin, row.broadcast_id)
      continue
    }

    if (statusAction === 'release') {
      await releaseRecipientToPending(admin, row.id)
      skipped++
      continue
    }

    const eligibility = getBroadcastContactEligibility(row.contact)
    if (!eligibility.eligible) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'skipped',
          skipped_reason: eligibility.reason,
          error_message: null,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      skipped++
      continue
    }

    if (!row.broadcast.template_language) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message:
            'Selected template has no approved language. Please re-sync templates and select an approved template.',
          last_error_message:
            'Selected template has no approved language. Please re-sync templates and select an approved template.',
          failure_type: 'permanent',
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      failed++
      continue
    }

    const templateKey = `${workspaceId}:${row.broadcast.template_name}:${row.broadcast.template_language}`
    if (!approvedTemplateCache.has(templateKey)) {
      const { data: approved } = await admin
        .from('message_templates')
        .select('body_text')
        .eq('workspace_id', workspaceId)
        .eq('name', row.broadcast.template_name)
        .eq('language', row.broadcast.template_language)
        .in('status', [...APPROVED_TEMPLATE_STATUSES])
        .maybeSingle()
      approvedTemplateCache.set(
        templateKey,
        approved ? { body_text: approved.body_text ?? '' } : null,
      )
    }

    const approvedTemplate = approvedTemplateCache.get(templateKey)
    if (!approvedTemplate) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message:
            'This template/language is not available in Meta anymore. Please re-sync templates and select an approved template again.',
          last_error_message:
            'This template/language is not available in Meta anymore. Please re-sync templates and select an approved template again.',
          failure_type: 'permanent',
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      failed++
      continue
    }

    let config = configByWorkspace.get(workspaceId)
    if (!config) {
      const { config: workspaceConfig } = await findWorkspaceWhatsAppConfig<{
        phone_number_id: string
        access_token: string
        status: string
      }>({
        workspaceId,
        columns: 'phone_number_id, access_token, status',
      })
      if (workspaceConfig) {
        config = workspaceConfig
        configByWorkspace.set(workspaceId, workspaceConfig)
      }
    }

    if (!config || config.status !== 'connected') {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message: 'WhatsApp is not connected.',
          last_error_message: 'WhatsApp is not connected.',
          failure_type: 'permanent',
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      failed++
      continue
    }

    const usageReservation = await reserveWorkspaceBroadcastUsage({
      workspaceId,
      count: 1,
    })

    if (!usageReservation.allowed) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message: usageReservation.message ?? 'Broadcast message limit reached.',
          last_error_message: usageReservation.message ?? 'Broadcast message limit reached.',
          failure_type: 'permanent',
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      failed++
      continue
    }

    const now = new Date().toISOString()
    const result = await (async () => {
      try {
        return await sendQueuedTemplateRecipient({
          phoneNumberId: config.phone_number_id,
          accessToken: decrypt(config.access_token),
          broadcast: row.broadcast,
          contact: row.contact!,
          customValues: customValues.get(row.contact!.id),
          attemptCount: row.attempt_count ?? 1,
        })
      } catch (error) {
        return {
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown worker send error',
          failure_type: 'unknown' as const,
          next_retry_at: null,
        }
      }
    })()

    if (result.status === 'sent') {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'sent',
          sent_at: now,
          whatsapp_message_id: result.whatsapp_message_id,
          error_message: null,
          last_error_message: null,
          failure_type: null,
          next_retry_at: null,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)

      try {
        await recordSentBroadcastMessage({
          admin,
          workspaceId,
          userId: row.broadcast.user_id,
          contactId: row.contact!.id,
          whatsappMessageId: result.whatsapp_message_id!,
          templateName: row.broadcast.template_name,
          contentText: renderTemplatePreview(
            approvedTemplate.body_text,
            result.resolved_params ?? [],
          ),
          sentAt: now,
        })
      } catch (error) {
        // Meta has already accepted the message, so never mark the recipient
        // failed or retry the external send merely because Inbox mirroring
        // failed. The database RPC is idempotent and this error is surfaced
        // for operational repair without risking a duplicate WhatsApp send.
        console.error(
          '[broadcast-worker] sent message could not be mirrored to Inbox:',
          error instanceof Error ? error.message : error,
        )
      }
      sent++
    } else {
      await releaseWorkspaceBroadcastUsage({
        workspaceId,
        count: usageReservation.reserved,
      })
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message: result.error,
          last_error_message: result.error,
          failure_type: result.failure_type,
          next_retry_at: result.next_retry_at,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', row.id)
      failed++
    }

    await sleep(BROADCAST_QUEUE_DELAY_MS)
  }

  for (const broadcastId of touchedBroadcasts) {
    await admin
      .from('broadcasts')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('status', 'queued')
    await finalizeBroadcastIfDone(broadcastId)
  }

  await finishWorkerRun(admin, runId, {
    status: 'completed',
    processed,
    sent,
    failed,
    skipped,
  })

  return NextResponse.json({ processed, sent, failed, skipped })
}

export async function GET(request: Request) {
  return processQueue(request)
}

export async function POST(request: Request) {
  return processQueue(request)
}
