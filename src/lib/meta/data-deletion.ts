import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export type MetaDataDeletionPayload = {
  user_id?: string
  userID?: string
  algorithm?: string
  issued_at?: number
  [key: string]: unknown
}

export type MetaDataDeletionStatus =
  | 'received'
  | 'manual_review_required'
  | 'no_matching_user_data_found'
  | 'processing'
  | 'completed'
  | 'failed'

export function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, 'base64')
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaDataDeletionPayload | null {
  const [encodedSignature, encodedPayload] = signedRequest.split('.', 2)
  if (!encodedSignature || !encodedPayload || !appSecret) return null

  const expectedSignature = createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest()
  const actualSignature = base64UrlDecode(encodedSignature)

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as unknown
    if (!payload || typeof payload !== 'object') return null
    return payload as MetaDataDeletionPayload
  } catch {
    return null
  }
}

export function createMetaSignedRequestForTest(
  payload: MetaDataDeletionPayload,
  appSecret: string,
): string {
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const encodedSignature = base64UrlEncode(
    createHmac('sha256', appSecret).update(encodedPayload).digest(),
  )
  return `${encodedSignature}.${encodedPayload}`
}

export function createDeletionConfirmationCode(): string {
  return `TW-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`
}

export function hashMetaUserId(metaUserId: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(metaUserId).digest('hex')
}

export function normalizeMetaUserId(payload: MetaDataDeletionPayload): string {
  const userId = payload.user_id ?? payload.userID
  return typeof userId === 'string' ? userId.trim() : ''
}
