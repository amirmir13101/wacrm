import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8')

describe('human WhatsApp typing integration', () => {
  const route = readSource('src/app/api/whatsapp/typing/route.ts')
  const composer = readSource('src/components/inbox/message-composer.tsx')
  const thread = readSource('src/components/inbox/message-thread.tsx')
  const autoReply = readSource('src/lib/ai/auto-reply.ts')

  it('gates human typing behind authenticated handoff access', () => {
    expect(route).toContain("'reply_to_conversations'")
    expect(route).toContain('canSeeConversation')
    expect(route).toContain('conversation.ai_autoreply_disabled !== true')
    expect(route).toContain('RATE_LIMITS.humanTyping')
  })

  it('signals only from real composer activity and becomes idle on blur or send', () => {
    expect(composer).toContain('onTypingActivity?.()')
    expect(composer).toContain('onTypingIdle?.()')
    expect(composer).toContain('onBlur={onTypingIdle}')
    expect(thread).toContain('HUMAN_TYPING_IDLE_MS')
    expect(thread).toContain('shouldSendHumanTypingSignal')
    expect(thread).toContain('fetch("/api/whatsapp/typing"')
  })

  it('preserves the separate AI processing typing path', () => {
    expect(autoReply).toContain('sendTypingIndicator')
    expect(autoReply).toContain('conv.ai_autoreply_disabled')
    expect(autoReply).toContain('currentConv.ai_autoreply_disabled')
  })
})
