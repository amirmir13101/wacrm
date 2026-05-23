import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()
  const { data: automation, error: automationError } = await admin
    .from('automations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (automationError) {
    return NextResponse.json({ error: automationError.message }, { status: 500 })
  }
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [logsRes, pendingRes] = await Promise.all([
    admin
      .from('automation_logs')
      .select('*, contact:contacts(id, name, phone)')
      .eq('automation_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('automation_pending_executions')
      .select('id, contact_id, log_id, status, run_at, created_at')
      .eq('automation_id', id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'running'])
      .order('run_at', { ascending: true })
      .limit(50),
  ])

  if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 })
  if (pendingRes.error) {
    return NextResponse.json({ error: pendingRes.error.message }, { status: 500 })
  }

  return NextResponse.json({
    automation,
    logs: logsRes.data ?? [],
    pendingExecutions: pendingRes.data ?? [],
  })
}
