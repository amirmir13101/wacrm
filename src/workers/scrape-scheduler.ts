import { config as loadEnv } from 'dotenv'

/**
 * PM2 cron runner for CRM background jobs.
 *
 * The public API routes keep the actual business logic and permission checks.
 * This process only calls those routes from the same VPS on a fixed schedule,
 * using AUTOMATION_CRON_SECRET. Never log the secret or environment values.
 */

loadEnv({ path: '.env.local', override: false, quiet: true })
loadEnv({ path: '.env', override: false, quiet: true })

type SchedulerJob = {
  readonly name: string
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly intervalMs: number
  readonly timeoutMs: number
}

const ONE_MINUTE = 60_000
const FIVE_MINUTES = 5 * ONE_MINUTE
const DEFAULT_TIMEOUT_MS = 45_000

const jobs: SchedulerJob[] = [
  {
    name: 'broadcast-worker',
    method: 'POST',
    path: '/api/whatsapp/broadcast/worker',
    intervalMs: ONE_MINUTE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: 'automations-cron',
    method: 'GET',
    path: '/api/automations/cron',
    intervalMs: ONE_MINUTE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: 'flows-cron',
    method: 'GET',
    path: '/api/flows/cron',
    intervalMs: FIVE_MINUTES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
]

const baseUrl = (
  process.env.WACRM_SCHEDULER_BASE_URL ??
  `http://127.0.0.1:${process.env.PORT || '3000'}`
).replace(/\/$/, '')

const inFlight = new Set<string>()
const timers: NodeJS.Timeout[] = []
let stopping = false
let warnedMissingSecret = false

function summarizePayload(payload: unknown): Record<string, unknown> | string | null {
  if (!payload || typeof payload !== 'object') return null

  const value = payload as Record<string, unknown>
  const safeKeys = [
    'success',
    'processed',
    'sent',
    'failed',
    'skipped',
    'claimed',
    'queued',
    'finished',
    'error',
    'message',
  ]

  return Object.fromEntries(
    safeKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => [key, value[key]]),
  )
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 160)
  }
}

async function runJob(job: SchedulerJob): Promise<void> {
  if (stopping) return

  const secret = process.env.AUTOMATION_CRON_SECRET
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true
      console.warn(
        '[wacrm-scheduler] AUTOMATION_CRON_SECRET is missing; background CRM jobs are paused.',
      )
    }
    return
  }

  if (inFlight.has(job.name)) {
    console.warn(`[wacrm-scheduler] skipped overlapping ${job.name} run`)
    return
  }

  inFlight.add(job.name)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), job.timeoutMs)

  try {
    const response = await fetch(`${baseUrl}${job.path}`, {
      method: job.method,
      headers: {
        'x-cron-secret': secret,
      },
      signal: controller.signal,
    })
    const payload = await parseResponse(response)
    const summary = summarizePayload(payload)

    if (!response.ok) {
      console.warn(`[wacrm-scheduler] ${job.name} failed`, {
        status: response.status,
        summary,
      })
      return
    }

    console.info(`[wacrm-scheduler] ${job.name} completed`, {
      status: response.status,
      summary,
    })
  } catch (error) {
    console.warn(`[wacrm-scheduler] ${job.name} errored`, {
      error: error instanceof Error ? error.message : 'unknown error',
    })
  } finally {
    clearTimeout(timeout)
    inFlight.delete(job.name)
  }
}

function scheduleJob(job: SchedulerJob): void {
  const firstRun = setTimeout(() => void runJob(job), 5_000)
  const interval = setInterval(() => void runJob(job), job.intervalMs)
  timers.push(firstRun, interval)
}

function shutdown(signal: string): void {
  if (stopping) return
  stopping = true
  for (const timer of timers) clearTimeout(timer)
  console.info(`[wacrm-scheduler] received ${signal}; stopping scheduler`)
  setTimeout(() => process.exit(0), 250)
}

console.info('[wacrm-scheduler] starting CRM scheduler', {
  baseUrl,
  jobs: jobs.map((job) => ({
    name: job.name,
    method: job.method,
    path: job.path,
    intervalMs: job.intervalMs,
  })),
})

for (const job of jobs) scheduleJob(job)

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
