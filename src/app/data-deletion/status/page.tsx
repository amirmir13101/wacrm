import type { Metadata } from 'next'
import Link from 'next/link'

import {
  InfoCard,
  InfoHero,
  InfoPageShell,
  InfoSection,
} from '@/components/marketing/info-page'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getCanonicalUrl } from '@/lib/site-url'

const SUPPORT_EMAIL = 'support@talkwagon.chat'
const canonicalUrl = getCanonicalUrl('/data-deletion/status')

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Data Deletion Status | Talk Wagon',
  description:
    'Check the receipt status for a Talk Wagon Meta/Facebook data deletion request confirmation code.',
  alternates: {
    canonical: canonicalUrl,
  },
  robots: {
    index: false,
    follow: false,
  },
}

type PageProps = {
  searchParams?: Promise<{ code?: string }>
}

type DeletionStatusRecord = {
  confirmation_code: string
  status: string
  requested_at: string
  processed_at: string | null
}

async function loadDeletionStatus(code: string): Promise<DeletionStatusRecord | null> {
  if (!code) return null

  try {
    const { data, error } = await supabaseAdmin()
      .from('meta_data_deletion_requests')
      .select('confirmation_code, status, requested_at, processed_at')
      .eq('confirmation_code', code)
      .maybeSingle()

    if (error) return null
    return data as DeletionStatusRecord | null
  } catch {
    return null
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export default async function DataDeletionStatusPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = typeof params?.code === 'string' ? params.code.trim() : ''
  const record = await loadDeletionStatus(code)

  return (
    <InfoPageShell>
      <InfoHero
        eyebrow="Data Deletion Status"
        title="Meta Data Deletion Request Receipt"
        description="Use this page to confirm that Talk Wagon received a Meta/Facebook data deletion request callback."
        badges={['Request received', 'Secure status lookup', 'No private data shown']}
      />

      <InfoSection title="Request Status">
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="Confirmation code">
            <span className="font-mono text-[#07130e]">{code || 'No confirmation code provided'}</span>
          </InfoCard>
          <InfoCard title="Deletion/review status">
            {record ? (
              <span className="capitalize">{statusLabel(record.status)}</span>
            ) : (
              'Request received or pending review. If this code was issued recently, please contact support for confirmation.'
            )}
          </InfoCard>
          <InfoCard title="Requested at">
            {record ? new Date(record.requested_at).toLocaleString('en-GB') : 'Not available'}
          </InfoCard>
          <InfoCard title="Processed at">
            {record?.processed_at
              ? new Date(record.processed_at).toLocaleString('en-GB')
              : 'Not completed yet'}
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection title="Need Help?">
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            For questions about this request, email{' '}
            <a className="font-bold text-[#08bba4]" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{' '}
            and include your confirmation code. Do not send API keys, passwords, Meta app secrets, or
            access tokens.
          </p>
          <p className="mt-4">
            You can also review the{' '}
            <Link className="font-bold text-[#08bba4]" href="/data-deletion">
              Meta data deletion instructions
            </Link>
            .
          </p>
        </div>
      </InfoSection>
    </InfoPageShell>
  )
}
