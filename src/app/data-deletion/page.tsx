import type { Metadata } from 'next'
import Link from 'next/link'

import {
  InfoCard,
  InfoCardGrid,
  InfoCta,
  InfoHero,
  InfoPageShell,
  InfoSection,
} from '@/components/marketing/info-page'
import { BreadcrumbJsonLd, WebPageJsonLd } from '@/components/marketing/seo-json-ld'
import { getCanonicalUrl } from '@/lib/site-url'

const SUPPORT_EMAIL = 'support@talkwagon.chat'
const canonicalUrl = getCanonicalUrl('/data-deletion')
const pageDescription =
  'Instructions for requesting deletion of Meta, Facebook, WhatsApp Business, and Embedded Signup connection data connected to Talk Wagon CRM.'

export const metadata: Metadata = {
  title: 'Meta Data Deletion Instructions',
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'Talk Wagon Meta Data Deletion Instructions',
    description:
      'How Talk Wagon users can request deletion of Meta/Facebook/WhatsApp connection data.',
    url: canonicalUrl,
    siteName: 'Talk Wagon',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Meta Data Deletion Instructions',
    description: pageDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function DataDeletionPage() {
  return (
    <>
      <WebPageJsonLd path="/data-deletion" name="Talk Wagon Meta Data Deletion Instructions" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Data Deletion', url: '/data-deletion' },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Meta Data Deletion"
        title="Request Deletion of Meta and WhatsApp Connection Data"
        description="This page explains how Talk Wagon clients can request deletion of Meta, Facebook, and WhatsApp Business connection data created through Meta Embedded Signup or related WhatsApp API setup."
        badges={['Meta app review ready', 'Workspace ownership check', 'Secure token handling']}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Data Deletion', href: '/data-deletion' },
        ]}
      />

      <InfoSection
        title="How to Request Deletion"
        description="You can disconnect Talk Wagon from Meta directly, or contact us so we can verify ownership and remove/revoke related connection data."
      >
        <InfoCardGrid>
          <InfoCard title="Remove Talk Wagon in Meta">
            You may remove Talk Wagon from Facebook or Meta Business Integrations where your connected
            business apps are managed. This disconnects the app from your Meta account according to
            Meta&apos;s controls.
          </InfoCard>
          <InfoCard title="Request deletion from Talk Wagon">
            Email{' '}
            <a className="font-bold text-[#08bba4]" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{' '}
            with your workspace email, company name, and a short request to delete Meta/Facebook
            connection data. We will verify account/workspace ownership before making changes.
          </InfoCard>
          <InfoCard title="Use the contact page">
            You can also contact us from the{' '}
            <Link className="font-bold text-[#08bba4]" href="/contact">
              Talk Wagon contact page
            </Link>
            . Do not send passwords, API keys, access tokens, or private credentials through public
            forms or chat.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection
        eyebrow="What may be removed"
        title="Data Covered by This Request"
        description="The exact data depends on how your workspace connected WhatsApp or Meta services."
        tint="green"
      >
        <InfoCardGrid>
          <InfoCard title="Meta/Facebook identifiers">
            Facebook app user ID if stored, Meta Business identifiers, WhatsApp Business Account
            identifiers, and related Embedded Signup connection identifiers.
          </InfoCard>
          <InfoCard title="WhatsApp connection data">
            WhatsApp Business Account connection data, WhatsApp phone number connection identifiers,
            and workspace connection status related to Meta setup.
          </InfoCard>
          <InfoCard title="Stored Meta access tokens">
            Stored Meta access tokens related to the verified workspace connection may be revoked,
            cleared, or replaced with a disconnected status where safe.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection title="Important Retention Notice">
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            Talk Wagon will only delete or revoke data when we can reliably verify that the request
            belongs to the exact Meta user, business, workspace, or connected account. We do not
            delete unrelated workspaces, contacts, message history, billing records, or business data
            by guessing.
          </p>
          <p className="mt-4">
            Some legally required billing, tax, security, fraud-prevention, abuse-prevention,
            support, and audit records may be retained where required or permitted by law.
          </p>
        </div>
      </InfoSection>

      <InfoSection title="Data Deletion Status">
        <div className="rounded-[24px] border border-[#3ddf84]/35 bg-[#f4fff9] p-6 text-base leading-8 text-[#315345]">
          <p>
            If you submitted a Meta data deletion callback request and received a confirmation code,
            you can check the request receipt page here:{' '}
            <Link className="font-bold text-[#08bba4]" href="/data-deletion/status">
              Data deletion status
            </Link>
            .
          </p>
        </div>
      </InfoSection>

      <InfoCta />
      </InfoPageShell>
    </>
  )
}
