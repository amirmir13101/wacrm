'use client'

import Link from 'next/link'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  buildPaymentProofWhatsAppUrl,
  MANUAL_PAYMENT_METHODS,
  type ManualCheckoutPlan,
  type ManualPaymentMethod,
} from '@/lib/payments/manual-payment-config'

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void
    }
  }
}

interface ManualCheckoutFormProps {
  plan: ManualCheckoutPlan
}

export function ManualCheckoutForm({ plan }: ManualCheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('easypaisa')
  const [payerName, setPayerName] = useState('')
  const [payerEmail, setPayerEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [transactionReference, setTransactionReference] = useState('')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [chatHint, setChatHint] = useState<string | null>(null)

  const proofUrl = useMemo(
    () =>
      buildPaymentProofWhatsAppUrl({
        plan,
        payerName,
        payerEmail,
        workspaceName,
        requestId: requestId ?? undefined,
      }),
    [payerEmail, payerName, plan, requestId, workspaceName],
  )

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: plan.planType,
          payment_method: paymentMethod,
          payer_name: payerName,
          payer_email: payerEmail,
          workspace_name: workspaceName,
          transaction_reference: transactionReference,
          note,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not submit payment request.')
      setRequestId(payload.request?.id ?? null)
      toast.success('Payment request submitted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit payment request.')
    } finally {
      setSubmitting(false)
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

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="space-y-5">
        <div className="rounded-[30px] bg-[#07130e] p-7 text-white shadow-[0_24px_70px_rgba(7,19,14,0.20)]">
          <p className="text-sm font-bold uppercase text-[#3ddf84]">Manual checkout</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{plan.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#d5e9e2]">{plan.description}</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-5">
            <p className="text-sm text-[#d5e9e2]">{plan.billingLabel}</p>
            <p className="mt-2 text-5xl font-extrabold text-[#ffbd29]">{plan.priceLabel}</p>
          </div>
          <p className="mt-5 flex gap-2 text-sm leading-6 text-[#d8fff1]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#3ddf84]" />
            {plan.activationNote}
          </p>
        </div>

        <div className="rounded-[28px] border border-[#dbe9e2] bg-white p-6">
          <h2 className="text-lg font-extrabold text-[#07130e]">Payment details</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b7169]">
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
            {MANUAL_PAYMENT_METHODS[paymentMethod].fields.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 border-b border-[#dbe9e2] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-[#5b7169]">{label}</span>
                <span className="font-bold text-[#07130e]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="rounded-[30px] border border-[#dbe9e2] bg-white p-6 shadow-[0_18px_55px_rgba(7,19,14,0.08)] sm:p-8">
        {requestId ? (
          <div className="rounded-2xl border border-[#08bba4]/30 bg-[#e9fff6] p-5">
            <h2 className="text-xl font-extrabold text-[#07130e]">Request submitted</h2>
            <p className="mt-2 text-sm leading-7 text-[#31584a]">
              Your request ID is <span className="font-bold">{requestId}</span>. Send your payment proof now so
              the platform admin can approve your {plan.shortTitle} activation.
            </p>
          </div>
        ) : null}

        <form onSubmit={(event) => void submitRequest(event)} className="mt-6 space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold text-[#07130e]">Submit payment request</h2>
            <p className="mt-2 text-sm text-[#5b7169]">
              This does not charge a card. It creates a manual approval request for Talk Wagon admin review.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                required
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
                placeholder="Your name"
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

          <Field label="Workspace / Business Name">
            <input
              required
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              className="h-12 w-full rounded-2xl border border-[#dbe9e2] bg-[#f7fbf8] px-4 text-[#07130e] outline-none focus:border-[#08bba4]"
              placeholder="Your company or workspace"
            />
          </Field>

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

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#3ddf84] px-6 text-sm font-extrabold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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
        </form>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#07130e] px-5 text-sm font-bold text-white hover:bg-[#1b372b]"
          >
            <MessageCircle className="mr-2 size-4" />
            Send Proof on WhatsApp
          </Link>
          <button
            type="button"
            onClick={openTawkChat}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#08bba4] px-5 text-sm font-bold text-[#07130e] hover:bg-[#e9fff6]"
          >
            <Send className="mr-2 size-4" />
            Talk to Agent
          </button>
        </div>
        {chatHint ? <p className="mt-3 text-sm text-[#5b7169]">{chatHint}</p> : null}
      </section>
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
