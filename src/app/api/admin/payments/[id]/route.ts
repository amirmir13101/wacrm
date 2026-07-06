import { NextResponse } from 'next/server'

import { requirePlatformAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/automations/admin-client'

type PaymentAction = 'approve' | 'reject'

interface ManualPaymentRequestRow {
  readonly id: string
  readonly workspace_id: string | null
  readonly user_id: string | null
  readonly plan_type: 'pro' | 'lifetime'
  readonly billing_period: 'monthly' | 'yearly' | 'lifetime_setup' | null
  readonly payer_email: string
  readonly status: 'pending' | 'approved' | 'rejected'
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readAction(value: unknown): PaymentAction | null {
  return value === 'approve' || value === 'reject' ? value : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requirePlatformAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = readAction(body?.action)
  const adminNote = readString(body?.admin_note)

  if (!action) {
    return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: paymentRequest, error: lookupError } = await admin
    .from('manual_payment_requests')
    .select('id, workspace_id, user_id, plan_type, billing_period, payer_email, status')
    .eq('id', id)
    .maybeSingle<ManualPaymentRequestRow>()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!paymentRequest) return NextResponse.json({ error: 'Payment request not found.' }, { status: 404 })
  if (paymentRequest.status !== 'pending') {
    return NextResponse.json({ error: 'This payment request has already been reviewed.' }, { status: 400 })
  }

  if (action === 'reject') {
    const { data, error } = await admin
      .from('manual_payment_requests')
      .update({
        status: 'rejected',
        admin_note: adminNote || null,
        rejected_by: adminCheck.profile.id,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data })
  }

  if (paymentRequest.plan_type === 'pro') {
    const { data, error } = await admin
      .rpc('approve_manual_pro_payment', {
        p_request_id: paymentRequest.id,
        p_admin_profile_id: adminCheck.profile.id,
        p_admin_note: adminNote || null,
        p_now: new Date().toISOString(),
      })
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data })
  }

  const { data, error } = await admin
    .from('manual_payment_requests')
    .update({
      workspace_id: paymentRequest.workspace_id,
      status: 'approved',
      admin_note: adminNote || null,
      approved_by: adminCheck.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, status, workspace_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requirePlatformAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
  }

  const { id } = await params
  const admin = supabaseAdmin()
  const { data: paymentRequest, error: lookupError } = await admin
    .from('manual_payment_requests')
    .select('id, status')
    .eq('id', id)
    .maybeSingle<{ id: string; status: 'pending' | 'approved' | 'rejected' }>()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!paymentRequest) return NextResponse.json({ error: 'Payment request not found.' }, { status: 404 })

  const { error } = await admin.from('manual_payment_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deleted_id: id })
}
