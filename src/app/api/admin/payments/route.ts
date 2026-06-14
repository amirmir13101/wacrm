import { NextResponse } from 'next/server'

import { requirePlatformAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/automations/admin-client'

const STATUS_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function parseStatus(value: string | null): StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter) ? (value as StatusFilter) : 'pending'
}

export async function GET(request: Request) {
  const adminCheck = await requirePlatformAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }

  const url = new URL(request.url)
  const status = parseStatus(url.searchParams.get('status'))
  const admin = supabaseAdmin()

  let query = admin
    .from('manual_payment_requests')
    .select(
      'id, workspace_id, user_id, plan_type, amount, currency, payment_method, payer_name, payer_email, phone, company_name, workspace_name, transaction_reference, note, status, admin_note, auth_user_created, approved_at, rejected_at, created_at, updated_at, workspace:workspaces(name, plan_type, subscription_status)',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]

  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
    : { data: [] }

  const profileByUserId = new Map(
    ((profiles ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>).map(
      (profile) => [profile.user_id, profile],
    ),
  )

  return NextResponse.json({
    requests: (data ?? []).map((row) => ({
      ...row,
      profile: row.user_id ? profileByUserId.get(row.user_id) ?? null : null,
    })),
  })
}
