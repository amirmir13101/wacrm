import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualCheckoutForm } from '@/components/checkout/manual-checkout-form'
import { PublicFooter } from '@/components/marketing/public-footer'
import { getManualCheckoutPlan } from '@/lib/payments/manual-payment-config'

const siteUrl = 'https://vpscoaster.live'

interface CheckoutPageProps {
  params: Promise<{ plan: string }>
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { plan: planSlug } = await params
  const plan = getManualCheckoutPlan(planSlug)

  if (!plan) {
    return {
      title: 'Manual Checkout | Talk Wagon',
      robots: { index: false, follow: false },
    }
  }

  return {
    title: `${plan.shortTitle} Manual Checkout | Talk Wagon`,
    description: `Submit a manual payment request for ${plan.title}. Send payment proof by WhatsApp or live chat for admin approval.`,
    alternates: {
      canonical: `${siteUrl}/checkout/${plan.checkoutSlug}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { plan: planSlug } = await params
  const plan = getManualCheckoutPlan(planSlug)

  if (!plan) notFound()

  return (
    <main className="min-h-screen bg-[#f7fbf8] text-[#07130e]">
      <section className="px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <ManualCheckoutForm plan={plan} />
        </div>
      </section>
      <PublicFooter />
    </main>
  )
}
