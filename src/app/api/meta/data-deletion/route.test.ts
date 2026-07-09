import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { createMetaSignedRequestForTest } from '@/lib/meta/data-deletion'

const insertMock = vi.fn()

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}))

describe('Meta data deletion callback route', () => {
  beforeEach(() => {
    vi.stubEnv('META_APP_SECRET', 'test-app-secret')
    insertMock.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('rejects missing signed_request', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      new Request('https://app.talkwagon.chat/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'Missing signed_request.' })
  })

  it('rejects invalid signed_request signatures', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      new Request('https://app.talkwagon.chat/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signed_request: 'bad.signature' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'Invalid signed_request.' })
  })

  it('returns Meta confirmation JSON for a valid JSON signed_request', async () => {
    const { POST } = await import('./route')
    const signedRequest = createMetaSignedRequestForTest(
      { user_id: 'meta-user-123', algorithm: 'HMAC-SHA256' },
      'test-app-secret',
    )

    const response = await POST(
      new Request('https://app.talkwagon.chat/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signed_request: signedRequest }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.confirmation_code).toMatch(/^TW-[A-F0-9]{16}$/)
    expect(body.url).toBe(
      `https://talkwagon.chat/data-deletion/status?code=${body.confirmation_code}`,
    )
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation_code: body.confirmation_code,
        meta_user_id_hash: expect.any(String),
        status: 'manual_review_required',
      }),
    )
  })

  it('supports form-urlencoded signed_request submissions', async () => {
    const { POST } = await import('./route')
    const signedRequest = createMetaSignedRequestForTest(
      { user_id: 'meta-user-456' },
      'test-app-secret',
    )
    const response = await POST(
      new Request('https://app.talkwagon.chat/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ signed_request: signedRequest }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toHaveProperty('confirmation_code')
  })

  it('does not store the full signed_request or raw Meta user ID', async () => {
    const { POST } = await import('./route')
    const signedRequest = createMetaSignedRequestForTest(
      { user_id: 'raw-meta-user' },
      'test-app-secret',
    )

    await POST(
      new Request('https://app.talkwagon.chat/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signed_request: signedRequest }),
      }),
    )

    const stored = insertMock.mock.calls[0]?.[0] ?? {}
    expect(JSON.stringify(stored)).not.toContain(signedRequest)
    expect(JSON.stringify(stored)).not.toContain('raw-meta-user')
    expect(JSON.stringify(stored)).not.toContain('test-app-secret')
  })
})
