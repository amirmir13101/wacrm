import { NextResponse } from 'next/server'

import { requirePlatformAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { ensureApprovedUserOwnWorkspace } from '@/lib/team/server'

type PaymentAction = 'approve' | 'reject'

interface ManualPaymentRequestRow {
  readonly id: string
  readonly workspace_id: string | null
  readonly user_id: string | null
  readonly plan_type: 'pro' | 'lifetime'
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
    .select('id, workspace_id, user_id, plan_type, payer_email, status')
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
      .select('id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data })
  }

  const customerUserId = await approvePaymentCustomer(paymentRequest, adminCheck.profile.id)
  const workspaceId = await resolveWorkspaceId(paymentRequest, customerUserId)
  if (!workspaceId) {
    return NextResponse.json(
      {
        error:
          'This payment request is not linked to a customer workspace. Ask the customer to resubmit checkout or contact support.',
      },
      { status: 400 },
    )
  }

  const { error: workspaceError } = await admin
    .from('workspaces')
    .update({
      plan_type: paymentRequest.plan_type,
      subscription_status: 'active',
      plan_updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)

  if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 })

  const { data, error } = await admin
    .from('manual_payment_requests')
    .update({
      workspace_id: workspaceId,
      status: 'approved',
      admin_note: adminNote || null,
      approved_by: adminCheck.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status, workspace_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}

async function approvePaymentCustomer(
  paymentRequest: ManualPaymentRequestRow,
  approvedByProfileId: string,
): Promise<string | null> {
  const admin = supabaseAdmin()
  let userId = paymentRequest.user_id

  if (!userId) {
    const { data: profile, error } = await admin
      .from('profiles')
      .select('user_id')
      .ilike('email', paymentRequest.payer_email)
      .or('account_type.is.null,account_type.neq.team_member')
      .maybeSingle()

    if (error) throw new Error(error.message)
    userId = profile?.user_id ?? null
  }

  if (!userId) return null

  const { error } = await admin
    .from('profiles')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedByProfileId,
    })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return userId
}

async function resolveWorkspaceId(
  paymentRequest: ManualPaymentRequestRow,
  approvedUserId: string | null,
): Promise<string | null> {
  if (paymentRequest.workspace_id) return paymentRequest.workspace_id

  const admin = supabaseAdmin()
  let userId = approvedUserId ?? paymentRequest.user_id

  if (!userId) {
    const { data: profile, error } = await admin
      .from('profiles')
      .select('user_id')
      .ilike('email', paymentRequest.payer_email)
      .or('account_type.is.null,account_type.neq.team_member')
      .maybeSingle()

    if (error) throw new Error(error.message)
    userId = profile?.user_id ?? null
  }

  if (!userId) return null
  return ensureApprovedUserOwnWorkspace(userId)
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
  if (paymentRequest.status === 'approved') {
    return NextResponse.json(
      { error: 'Approved payment requests are kept for audit history and cannot be deleted.' },
      { status: 400 },
    )
  }

  const { error } = await admin.from('manual_payment_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deleted_id: id })
}
