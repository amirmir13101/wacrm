import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getManualCheckoutPlan, getManualPaymentMethod } from '@/lib/payments/manual-payment-config'
import { createClient } from '@/lib/supabase/server'
import { requireCurrentWorkspace } from '@/lib/team/server'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function passwordValidationError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password needs at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password needs at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password needs at least one number.'
  return null
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 })
  }

  const requestedPlanType = readString(body.plan_type)
  const requestedBillingPeriod = readString(body.billing_period)
  const planSlug = requestedPlanType
  const plan = getManualCheckoutPlan(planSlug)
  if (!plan) {
    return NextResponse.json({ error: 'Choose a valid checkout plan.' }, { status: 400 })
  }

  const billingPeriod = requestedBillingPeriod || plan.billingPeriod
  if (billingPeriod !== plan.billingPeriod) {
    return NextResponse.json({ error: 'Choose a valid billing period for this plan.' }, { status: 400 })
  }

  const paymentMethod = getManualPaymentMethod(readString(body.payment_method))
  if (!paymentMethod) {
    return NextResponse.json({ error: 'Choose Easypaisa or Bank Transfer.' }, { status: 400 })
  }

  let payerName = readString(body.payer_name)
  let payerEmail = readString(body.payer_email).toLowerCase()
  const phone = readString(body.phone)
  const password = readString(body.password)
  const companyName = readString(body.company_name)
  const workspaceName = companyName || `${payerName || 'Customer'} Workspace`
  const transactionReference = readString(body.transaction_reference)
  const note = readString(body.note)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let workspaceId: string | null = null
  let linkedUserId: string | null = null
  let authUserCreated = false

  if (user) {
    linkedUserId = user.id
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json({ error: 'Login found, but no active workspace was available.' }, { status: 400 })
    }
    workspaceId = workspaceResult.workspace.workspaceId
    const admin = supabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .maybeSingle()
    payerEmail = payerEmail || user.email?.toLowerCase() || String(profile?.email ?? '').toLowerCase()
    payerName = payerName || String(profile?.full_name ?? '') || payerEmail || 'Existing customer'
  } else {
    if (payerName.length < 2) {
      return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
    }

    if (!EMAIL_PATTERN.test(payerEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    if (phone.length < 7) {
      return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
    }

    const passwordError = passwordValidationError(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    try {
      const linked = await createOrLinkCheckoutCustomer({
        email: payerEmail,
        password,
        fullName: payerName,
        companyName,
        workspaceName,
      })
      linkedUserId = linked.userId
      workspaceId = linked.workspaceId
      authUserCreated = linked.authUserCreated
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not create or link customer account.' },
        { status: 400 },
      )
    }
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('manual_payment_requests')
    .insert({
      workspace_id: workspaceId,
      user_id: linkedUserId,
      plan_type: plan.planType,
      billing_period: plan.billingPeriod,
      amount: plan.amount,
      currency: plan.currency,
      payment_method: paymentMethod.id,
      payer_name: payerName,
      payer_email: payerEmail,
      phone,
      company_name: companyName || null,
      workspace_name: workspaceName,
      auth_user_created: authUserCreated,
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
    message:
      'Your payment request has been submitted. Please send your payment screenshot on WhatsApp or live chat. After verification, our team will activate your account.',
  })
}

async function createOrLinkCheckoutCustomer(args: {
  email: string
  password: string
  fullName: string
  companyName: string
  workspaceName: string
}): Promise<{ userId: string; workspaceId: string; authUserCreated: boolean }> {
  const admin = supabaseAdmin()
  const now = new Date().toISOString()
  const { data: existingProfile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, account_type, approval_status')
    .ilike('email', args.email)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)

  if (existingProfile) {
    if (existingProfile.account_type === 'team_member') {
      throw new Error('This email belongs to a team member account. Please login or use another email.')
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        full_name: args.fullName,
        account_type: 'workspace_owner',
        updated_at: now,
      })
      .eq('user_id', existingProfile.user_id)
    if (updateError) throw new Error(updateError.message)

    const workspaceId = await ensureCheckoutWorkspace({
      userId: existingProfile.user_id,
      workspaceName: args.workspaceName,
    })
    return { userId: existingProfile.user_id, workspaceId, authUserCreated: false }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
      account_type: 'workspace_owner',
    },
  })

  if (createError || !created.user) {
    throw new Error(
      createError?.message?.includes('already')
        ? 'An account already exists with this email. Please login first, then submit checkout again.'
        : createError?.message ?? 'Could not create customer account.',
    )
  }

  const userId = created.user.id
  const { error: profileUpsertError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      full_name: args.fullName,
      email: args.email,
      role: 'user',
      approval_status: 'pending',
      account_type: 'workspace_owner',
      must_change_password: false,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  )

  if (profileUpsertError) {
    await admin.auth.admin.deleteUser(userId)
    throw new Error(profileUpsertError.message)
  }

  const workspaceId = await ensureCheckoutWorkspace({ userId, workspaceName: args.workspaceName })
  return { userId, workspaceId, authUserCreated: true }
}

async function ensureCheckoutWorkspace(args: {
  userId: string
  workspaceName: string
}): Promise<string> {
  const admin = supabaseAdmin()
  const { data: existing, error: lookupError } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_user_id', args.userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)

  let workspaceId = existing?.id as string | undefined
  if (!workspaceId) {
    const { data: created, error: createError } = await admin
      .from('workspaces')
      .insert({
        name: args.workspaceName,
        owner_user_id: args.userId,
        plan_type: 'trial',
        subscription_status: 'trialing',
      })
      .select('id')
      .single()

    if (createError) throw new Error(createError.message)
    workspaceId = created.id
  }
  if (!workspaceId) throw new Error('Workspace setup failed.')

  const { error: memberError } = await admin.from('workspace_members').upsert(
    {
      workspace_id: workspaceId,
      user_id: args.userId,
      role: 'owner',
      status: 'active',
      permissions: {},
      can_connect_own_whatsapp: false,
      contact_visibility: 'all',
      conversation_visibility: 'all',
      deal_visibility: 'all',
      joined_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  )
  if (memberError) throw new Error(memberError.message)

  await admin
    .from('profiles')
    .update({ active_workspace_id: workspaceId })
    .eq('user_id', args.userId)
    .is('active_workspace_id', null)

  return workspaceId
}
