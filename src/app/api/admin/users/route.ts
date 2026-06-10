import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, approval_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' || profile.approval_status !== 'approved') {
    return { error: 'Admin access required', status: 403 as const }
  }

  return { user, profile }
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const includeDeleted = status === 'deleted' || searchParams.get('include_deleted') === '1'

  const admin = supabaseAdmin()
  let query = admin
    .from('profiles')
    .select(
      'id, user_id, full_name, email, role, approval_status, approved_at, approved_by, deleted_at, deleted_by, delete_reason, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('approval_status', status)
  } else if (!includeDeleted) {
    query = query.neq('approval_status', 'deleted')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: `Failed to load users: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ users: data ?? [] })
}
