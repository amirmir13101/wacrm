import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTemplateMessage } from './meta-api'

describe('sendTemplateMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
