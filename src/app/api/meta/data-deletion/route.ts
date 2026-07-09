import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  createDeletionConfirmationCode,
  hashMetaUserId,
  normalizeMetaUserId,
  verifyMetaSignedRequest,
  type MetaDataDeletionStatus,
} from '@/lib/meta/data-deletion'
import { getCanonicalUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

type DeletionRequestInsert = {
  confirmation_code: string
  meta_user_id_hash: string | null
  status: MetaDataDeletionStatus
  notes: string
}

async function readSignedRequest(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { signed_request?: unknown }
    return typeof body.signed_request === 'string' ? body.signed_request.trim() : ''
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData().catch(() => null)
    const value = form?.get('signed_request')
    return typeof value === 'string' ? value.trim() : ''
  }

  const text = await request.text().catch(() => '')
  if (!text) return ''

  try {
    const params = new URLSearchParams(text)
    return params.get('signed_request')?.trim() ?? ''
  } catch {
    return ''
  }
}

async function recordDeletionRequest(insert: DeletionRequestInsert) {
  try {
    const admin = supabaseAdmin()
    const { error } = await admin.from('meta_data_deletion_requests').insert(insert)
    if (error) {
      console.error('[meta data deletion] request storage failed')
    }
  } catch {
    console.error('[meta data deletion] request storage unavailable')
  }
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET ?? ''
  if (!appSecret) {
    return NextResponse.json({ error: 'Meta data deletion is not configured.' }, { status: 500 })
  }

  const signedRequest = await readSignedRequest(request)
  if (!signedRequest) {
    return NextResponse.json({ error: 'Missing signed_request.' }, { status: 400 })
  }

  const payload = verifyMetaSignedRequest(signedRequest, appSecret)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid signed_request.' }, { status: 400 })
  }

  const confirmationCode = createDeletionConfirmationCode()
  const metaUserId = normalizeMetaUserId(payload)
  const metaUserIdHash = metaUserId ? hashMetaUserId(metaUserId, appSecret) : null
  const status: MetaDataDeletionStatus = metaUserId
    ? 'manual_review_required'
    : 'no_matching_user_data_found'
  const notes = metaUserId
    ? 'Request received. No reliable automatic workspace mapping is available; manual ownership review is required before revoking workspace connection data.'
    : 'Request received without a Meta user ID in the signed payload; no matching user data could be identified automatically.'

  await recordDeletionRequest({
    confirmation_code: confirmationCode,
    meta_user_id_hash: metaUserIdHash,
    status,
    notes,
  })

  return NextResponse.json({
    url: getCanonicalUrl(`/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`),
    confirmation_code: confirmationCode,
  })
}
