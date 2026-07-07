'use client'

import Link from 'next/link'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  buildPaymentProofWhatsAppUrl,
  MANUAL_PAYMENT_METHODS,
  type ManualCheckoutPlan,
  type ManualPaymentMethod,
} from '@/lib/payments/manual-payment-config'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void
      hideWidget?: () => void
      showWidget?: () => void
      onLoad?: () => void
    }
  }
}

interface ManualCheckoutFormProps {
  plan: ManualCheckoutPlan
}

export function ManualCheckoutForm({ plan }: ManualCheckoutFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('easypaisa')
  const [payerName, setPayerName] = useState('')
  const [payerEmail, setPayerEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [transactionReference, setTransactionReference] = useState('')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [chatHint, setChatHint] = useState<string | null>(null)
  const [checkoutMode, setCheckoutMode] = useState<'signup' | 'login' | 'signed-in'>('signup')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const isSignedInCheckout = checkoutMode === 'signed-in' && Boolean(signedInEmail)
  const selectedPaymentDetails = MANUAL_PAYMENT_METHODS[paymentMethod]

  const proofUrl = useMemo(
    () =>
      buildPaymentProofWhatsAppUrl({
        plan,
        payerName,
        payerEmail: signedInEmail ?? payerEmail,
        workspaceName: companyName,
      }),
    [companyName, payerEmail, payerName, plan, signedInEmail],
  )

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const email = data.user.email ?? ''
      setSignedInEmail(email || null)
      setPayerEmail((current) => current || email)
      setCheckoutMode('signed-in')
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: plan.planType,
          billing_period: plan.billingPeriod,
          payment_method: paymentMethod,
          ...(isSignedInCheckout
            ? { payer_email: signedInEmail }
            : {
                payer_name: payerName,
                payer_email: payerEmail,
                phone,
                password,
                company_name: companyName,
              }),
          transaction_reference: transactionReference,
          note,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not submit payment request.')
      setRequestId(payload.request?.id ?? null)
      toast.success('Payment request submitted. Send proof for manual verification.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit payment request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function loginInsideCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (error) throw new Error(error.message)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Login succeeded, but your session was not ready. Please try again.')

      const email = user.email ?? loginEmail
      setSignedInEmail(email)
      setPayerEmail(email)
      setCheckoutMode('signed-in')
      setLoginPassword('')
      toast.success('Logged in. You can submit your payment request now.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign in.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  function openTawkChat() {
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.maximize()
      setChatHint(null)
      return
    }
    setChatHint('Live chat is loading. If it does not open, use WhatsApp to send payment proof.')
  }

  if (requestId) {
    return (
      <section className="mx-auto flex min-h-[62vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#08bba4]/25 bg-white p-6 text-center shadow-[0_24px_70px_rgba(7,19,14,0.12)] sm:p-10">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e9fff6] text-[#08bba4]">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
            Form submitted successfully
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#31584a] sm:text-base">
            Please send your payment screenshot or payment proof to us on WhatsApp, or talk to our agent
            for help.
          </p>
          <ProofActions proofUrl={proofUrl} onOpenChat={openTawkChat} />
          {chatHint ? <p className="mt-3 text-sm text-[#5b7169]">{chatHint}</p> : null}
          <p className="mt-6 text-sm font-semibold leading-6 text-[#31584a]">
            If you have sent your payment screenshot, you can{' '}
            <Link href="/login" className="font-extrabold text-[#08bba4] underline-offset-4 hover:underline">
              login here
            </Link>
            .
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="order-2 space-y-5 lg:order-1">
        <div className="rounded-[30px] bg-[#07130e] p-7 text-white shadow-[0_24px_70px_rgba(7,19,14,0.20)]">
          <p className="text-sm font-bold uppercase text-[#3ddf84]">Manual checkout</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{plan.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#d5e9e2]">{plan.description}</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-5">
            <p className="text-sm text-[#d5e9e2]">{plan.billingLabel}</p>
            {plan.originalPriceLabel ? (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <span className="pb-1 text-xl font-bold text-[#d5e9e2]/60 line-through decoration-2">
                  {plan.originalPriceLabel}
                </span>
                <span className="text-5xl font-extrabold text-[#ffbd29]">{plan.priceLabel}</span>
              </div>
            ) : (
              <p className="mt-2 text-5xl font-extrabold text-[#ffbd29]">{plan.priceLabel}</p>
            )}
            {plan.offerLabel ? (
              <span className="mt-3 inline-flex rounded-full bg-[#3ddf84] px-3 py-1 text-xs font-extrabold uppercase text-[#07130e]">
                {plan.offerLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-5 flex gap-2 text-sm leading-6 text-[#d8fff1]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#3ddf84]" />
            {plan.activationNote}
          </p>
        </div>

        <div className="rounded-[28px] border border-[#dbe9e2] bg-white p-6">
          <h2 className="text-lg font-extrabold text-[#07130e]">Payment details</h2>
          <p className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
            Pay with Easypaisa or bank transfer, submit this form, then send payment proof to our team.
          </p>
          <div className="mt-5 grid gap-3">
            {(Object.values(MANUAL_PAYMENT_METHODS) as Array<(typeof MANUAL_PAYMENT_METHODS)[ManualPaymentMethod]>).map(
              (method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    paymentMethod === method.id
                      ? 'border-[#08bba4] bg-[#e9fff6]'
                      : 'border-[#dbe9e2] bg-[#f7fbf8] hover:border-[#08bba4]/60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-extrabold text-[#07130e]">{method.label}</span>
                    {paymentMethod === method.id ? (
                      <CheckCircle2 className="size-5 text-[#08bba4]" />
                    ) : null}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#5b7169]">{method.helper}</span>
                </button>
              ),
            )}
          </div>
          <div className="mt-5 rounded-2xl bg-[#f7fbf8] p-4">
            <h3 className="font-extrabold text-[#07130e]">{selectedPaymentDetails.label} details</h3>
            <p className="mt-1 text-xs leading-5 text-[#5b7169]">{selectedPaymentDetails.helper}</p>
            <div className="mt-2">
              {selectedPaymentDetails.fields.map(([label, value]) => (
                <div
                  key={`${selectedPaymentDetails.id}-${label}`}
                  className="flex flex-col gap-1 border-b border-[#dbe9e2] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-[#5b7169]">{label}</span>
                  <span className="font-bold text-[#07130e]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="order-1 rounded-[30px] border border-[#dbe9e2] bg-white p-6 shadow-[0_18px_55px_rgba(7,19,14,0.08)] sm:p-8 lg:order-2">
        <div className="mt-6">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-[#07130e]">
                  {isSignedInCheckout ? 'Submit payment request' : 'Create account and payment request'}
                </h2>
                <p className="mt-2 text-sm text-[#5b7169]">
                  {isSignedInCheckout
                    ? 'Your payment request will be linked to your current Talk Wagon account and workspace.'
                    : 'This creates your Talk Wagon customer login and a manual approval request. It does not charge a card or activate a paid plan automatically.'}
                </p>
              </div>
              {checkoutMode === 'signup' ? (
                <button
                  type="button"
                  onClick={() => setCheckoutMode('login')}
                  className="text-left text-sm font-bold text-[#08bba4] hover:text-[#07130e] sm:text-right"
                >
                  Already registered?
                </button>
              ) : null}
            </div>
          </div>

          {checkoutMode === 'login' ? (
            <form onSubmit={(event) => void loginInsideCheckout(event)} className="mt-6 space-y-5 rounded-3xl border border-[#dbe9e2] bg-[#f7fbf8] p-5">
              <div>
                <h3 className="text-lg font-extrabold text-[#07130e]">Login inside checkout</h3>
                <p className="mt-1 text-sm text-[#5b7169]">
                  Sign in here and stay on this checkout page. Then submit your manual payment request.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-white px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password">
                  <input
                    required
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-white px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="Enter your password"
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#07130e] px-6 text-sm font-extrabold text-white transition hover:bg-[#1b372b] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loginSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutMode('signup')}
                  className="text-sm font-bold text-[#08bba4] hover:text-[#07130e]"
                >
                  Need a new account? Continue with checkout signup
                </button>
              </div>
            </form>
          ) : null}

          {isSignedInCheckout ? (
            <div className="mt-6 rounded-2xl border border-[#08bba4]/30 bg-[#e9fff6] px-4 py-3 text-sm font-semibold text-[#31584a]">
              Logged in as <span className="font-extrabold">{signedInEmail}</span>. Submit your payment request below.
            </div>
          ) : null}
        </div>

        <form onSubmit={(event) => void submitRequest(event)} className="mt-6 space-y-5">
          {checkoutMode === 'signup' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    required
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="Your full name"
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={payerEmail}
                    onChange={(event) => setPayerEmail(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="you@example.com"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone number">
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="+92..."
                  />
                </Field>
                <Field label="Password">
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                    placeholder="Create a secure password"
                  />
                </Field>
              </div>

              <Field label="Company name (optional)">
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                  placeholder="Your company or business name"
                />
              </Field>
            </>
          ) : null}

          {checkoutMode !== 'login' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Selected plan">
                  <input
                    readOnly
                    value={`${plan.shortTitle} - ${plan.priceLabel}`}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e]"
                  />
                </Field>
                <Field label="Payment method">
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as ManualPaymentMethod)}
                    className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                  >
                    <option value="easypaisa">Easypaisa</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </Field>
              </div>

              <Field label="Transaction / reference number (optional)">
                <input
                  value={transactionReference}
                  onChange={(event) => setTransactionReference(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                  placeholder="Paste reference if you have one"
                />
              </Field>

              <Field label="Note (optional)">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 py-3 text-[#07130e] outline-none focus:border-[#08bba4]"
                  placeholder="Anything our admin should know?"
                />
              </Field>

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#3ddf84] px-8 text-sm font-extrabold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Payment Request'
                  )}
                </button>
              </div>
            </>
          ) : null}
        </form>
      </section>
    </div>
  )
}

function ProofActions({ proofUrl, onOpenChat }: { proofUrl: string; onOpenChat: () => void }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <Link
        href={proofUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-12 items-center justify-center rounded-full bg-[#07130e] px-5 text-sm font-bold text-white hover:bg-[#1b372b]"
      >
        <MessageCircle className="mr-2 size-4" />
        Send Payment Proof
      </Link>
      <button
        type="button"
        onClick={onOpenChat}
        className="inline-flex h-12 items-center justify-center rounded-full border border-[#08bba4] bg-white/60 px-5 text-sm font-bold text-[#07130e] hover:bg-white"
      >
        <Send className="mr-2 size-4" />
        Talk to Agent
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#07130e]">{label}</span>
      {children}
    </label>
  )
}
