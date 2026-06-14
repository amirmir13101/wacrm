import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getManualCheckoutPlan, getManualPaymentMethod } from '@/lib/payments/manual-payment-config'
import { createClient } from '@/lib/supabase/server'
import { requireCurrentWorkspace } from '@/lib/team/server'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 })
  }

  const plan = getManualCheckoutPlan(readString(body.plan_type))
  if (!plan) {
    return NextResponse.json({ error: 'Choose a valid checkout plan.' }, { status: 400 })
  }

  const paymentMethod = getManualPaymentMethod(readString(body.payment_method))
  if (!paymentMethod) {
    return NextResponse.json({ error: 'Choose Easypaisa or Bank Transfer.' }, { status: 400 })
  }

  const payerName = readString(body.payer_name)
  const payerEmail = readString(body.payer_email).toLowerCase()
  const workspaceName = readString(body.workspace_name)
  const transactionReference = readString(body.transaction_reference)
  const note = readString(body.note)

  if (payerName.length < 2) {
    return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
  }

  if (!EMAIL_PATTERN.test(payerEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  if (workspaceName.length < 2) {
    return NextResponse.json({ error: 'Enter your workspace or business name.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let workspaceId: string | null = null
  let linkedUserId: string | null = null

  if (user) {
    linkedUserId = user.id
    const workspaceResult = await requireCurrentWorkspace()
    if (workspaceResult.ok) {
      workspaceId = workspaceResult.workspace.workspaceId
    }
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('manual_payment_requests')
    .insert({
      workspace_id: workspaceId,
      user_id: linkedUserId,
      plan_type: plan.planType,
      amount: plan.amount,
      currency: plan.currency,
      payment_method: paymentMethod.id,
      payer_name: payerName,
      payer_email: payerEmail,
      workspace_name: workspaceName,
      transaction_reference: transactionReference || null,
      note: note || null,
      status: 'pending',
    })
    .select('id, status')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Could not submit your payment request.' }, { status: 500 })
  }

  return NextResponse.json({
    request: data,
    message: 'Payment request submitted. Send your proof on WhatsApp or live chat for admin approval.',
  })
}
