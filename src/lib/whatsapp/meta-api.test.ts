import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTemplateMessage, sendTypingIndicator } from './meta-api'

describe('sendTemplateMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.META_GRAPH_API_VERSION
  })

  it('builds Meta body parameters in order', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendTemplateMessage({
      phoneNumberId: 'phone-id',
      accessToken: 'token',
      to: '923489122663',
      templateName: 'amir_new_testing',
      language: 'en',
      params: ['Amir Mir', 'VPS'],
    })

    const calls = fetchMock.mock.calls as unknown as [RequestInfo | URL, RequestInit][]
    const requestInit = calls[0]?.[1]
    if (!requestInit) throw new Error('missing request init')
    const body = JSON.parse(requestInit.body as string)
    expect(body.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Amir Mir' },
          { type: 'text', text: 'VPS' },
        ],
      },
    ])
  })
})

describe('sendTypingIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.META_GRAPH_API_VERSION
  })

  it('uses the configured Graph API version and inbound message ID', async () => {
    process.env.META_GRAPH_API_VERSION = 'v24.0'
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendTypingIndicator({
      phoneNumberId: 'phone-id',
      accessToken: 'token',
      messageId: 'wamid.inbound',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v24.0/phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wamid.inbound',
          typing_indicator: { type: 'text' },
        }),
      }),
    )
  })
})
