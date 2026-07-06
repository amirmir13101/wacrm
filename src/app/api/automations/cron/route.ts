import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { resumePendingExecution, runAutomationsForTrigger } from '@/lib/automations/engine'
import { isAutomationCronSecretValid } from '@/lib/automations/cron-auth'
import type { AutomationContext } from '@/lib/automations/engine'
import { getScheduleDecision } from '@/lib/automations/schedule'

/**
 * Drain due `automation_pending_executions` rows. Meant to be hit
 * on a schedule (Vercel Cron / external pinger) — requires a shared
 * secret via the `x-cron-secret` header to match
 * `AUTOMATION_CRON_SECRET`.
 *
 * The claim step (status = 'running') serves as a simple lock so
 * overlapping invocations don't double-process rows. Best-effort
 * only; expensive SELECT ... FOR UPDATE is avoided in favor of a
 * two-step UPDATE-by-id.
 */
export async function GET(request: Request) {
  return handleAutomationCron(request)
}

export async function POST(request: Request) {
  return handleAutomationCron(request)
}

async function handleAutomationCron(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret')
  if (!isAutomationCronSecretValid(expected, supplied)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let waitProcessed = 0
  let timeBasedProcessed = 0
  try {
    const admin = supabaseAdmin()
    const now = new Date()
    waitProcessed = await processPendingWaits(admin, now)
    timeBasedProcessed = await processTimeBasedAutomations(admin, now)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Automation cron failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    processed: waitProcessed + timeBasedProcessed,
    wait_processed: waitProcessed,
    time_based_processed: timeBasedProcessed,
  })
}

async function processPendingWaits(admin: ReturnType<typeof supabaseAdmin>, now: Date) {
  const { data: due, error } = await admin
    .from('automation_pending_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', now.toISOString())
    .order('run_at', { ascending: true })
    .limit(50)

  if (error) throw new Error(error.message)
  if (!due || due.length === 0) return 0

  let processed = 0
  for (const row of due) {
    const { data: claim } = await admin
      .from('automation_pending_executions')
      .update({ status: 'running' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!claim) continue

    await resumePendingExecution({
      id: row.id as string,
      automation_id: row.automation_id as string,
      user_id: row.user_id as string,
      contact_id: (row.contact_id as string | null) ?? null,
      log_id: (row.log_id as string | null) ?? null,
      parent_step_id: (row.parent_step_id as string | null) ?? null,
      branch: (row.branch as 'yes' | 'no' | null) ?? null,
      next_step_position: row.next_step_position as number,
      context: (row.context as AutomationContext) ?? {},
    })
    processed++
  }

  return processed
}

async function processTimeBasedAutomations(admin: ReturnType<typeof supabaseAdmin>, now: Date) {
  const { data: automations, error } = await admin
    .from('automations')
    .select(
      'id, user_id, workspace_id, trigger_type, trigger_config, last_scheduled_run_at, next_scheduled_run_at, created_at',
    )
    .eq('trigger_type', 'time_based')
    .eq('is_active', true)
    .limit(100)

  if (error) throw new Error(error.message)
  if (!automations || automations.length === 0) return 0

  let processed = 0
  for (const automation of automations as Array<{
    id: string
    user_id: string
    workspace_id: string
    trigger_config: { schedule?: unknown }
    last_scheduled_run_at?: string | null
  }>) {
    const schedule = automation.trigger_config?.schedule
    const decision = getScheduleDecision(schedule, now, automation.last_scheduled_run_at ?? null)
    if (!decision.due) continue

    const update = {
      last_scheduled_run_at: now.toISOString(),
      next_scheduled_run_at: decision.nextRunAt?.toISOString() ?? null,
      last_executed_at: now.toISOString(),
    }
    let claimQuery = admin
      .from('automations')
      .update(update)
      .eq('id', automation.id)

    claimQuery = automation.last_scheduled_run_at
      ? claimQuery.eq('last_scheduled_run_at', automation.last_scheduled_run_at)
      : claimQuery.is('last_scheduled_run_at', null)

    const { data: claim, error: claimError } = await claimQuery.select('id').maybeSingle()
    if (claimError || !claim) continue

    await runAutomationsForTrigger({
      userId: automation.user_id,
      workspaceId: automation.workspace_id,
      automationId: automation.id,
      triggerType: 'time_based',
      contactId: null,
      context: {
        workspace_id: automation.workspace_id,
        vars: {
          schedule,
          scheduled_at: decision.dueAt?.toISOString() ?? now.toISOString(),
        },
      },
    })
    processed++
  }

  return processed
}
