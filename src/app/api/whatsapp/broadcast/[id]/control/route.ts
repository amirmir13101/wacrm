import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

type BroadcastAction = 'pause' | 'resume' | 'cancel'

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = body?.action as BroadcastAction | undefined
  if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Invalid broadcast action' }, { status: 400 })
  }

  const { data: broadcast } = await supabase
    .from('broadcasts')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

  if (action === 'pause') {
    if (!['queued', 'sending'].includes(broadcast.status)) {
      return NextResponse.json(
        { error: 'Only queued or sending broadcasts can be paused.' },
        { status: 400 },
      )
    }
    const { error } = await supabase
      .from('broadcasts')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'paused' })
  }

  if (action === 'resume') {
    if (broadcast.status !== 'paused') {
      return NextResponse.json(
        { error: 'Only paused broadcasts can be resumed.' },
        { status: 400 },
      )
    }
    const { error } = await supabase
      .from('broadcasts')
      .update({ status: 'queued', paused_at: null })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'queued' })
  }

  if (!['queued', 'sending', 'paused'].includes(broadcast.status)) {
    return NextResponse.json(
      { error: 'Only queued, sending, or paused broadcasts can be cancelled.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const { error: broadcastError } = await supabase
    .from('broadcasts')
    .update({ status: 'cancelled', cancelled_at: now })
    .eq('id', id)
    .eq('user_id', user.id)

  if (broadcastError) {
    return NextResponse.json({ error: broadcastError.message }, { status: 500 })
  }

  const { error: recipientError } = await supabase
    .from('broadcast_recipients')
    .update({
      status: 'skipped',
      skipped_reason: 'Broadcast cancelled before this recipient was sent.',
      locked_at: null,
      locked_by: null,
    })
    .eq('broadcast_id', id)
    .in('status', ['pending', 'sending'])

  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: 'cancelled' })
}
