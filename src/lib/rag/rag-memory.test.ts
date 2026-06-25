import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildRagStandaloneQueryPrompt,
  buildRagSystemPrompt,
  buildRagUserPrompt,
} from './chat'
import {
  formatRagConversationMemory,
  sanitizeRagConversationMessages,
} from './memory'

const chatService = readFileSync(join(process.cwd(), 'src/lib/rag/chat.ts'), 'utf8')
const memoryService = readFileSync(join(process.cwd(), 'src/lib/rag/memory.ts'), 'utf8')
const chatRoute = readFileSync(join(process.cwd(), 'src/app/api/rag/chat/route.ts'), 'utf8')
const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'), 'utf8')

describe('RAG conversation memory', () => {
  it('keeps starter-style recent browser messages in the dashboard request', () => {
    expect(page).toContain('chatHistory')
    expect(page).toContain('messages: chatHistory.slice(-20)')
    expect(page).toContain('Clear memory')
    expect(page).toContain('follow-up questions work like the Starter RAG chat')

    expect(chatRoute).toContain('const recentMessages = Array.isArray(body.messages) ? body.messages : []')
    expect(chatRoute).toContain('recentMessages')
  })

  it('loads WhatsApp conversation memory from existing CRM messages with workspace scoping', () => {
    expect(memoryService).toContain("from('conversations')")
    expect(memoryService).toContain(".eq('workspace_id', args.workspaceId)")
    expect(memoryService).toContain("from('messages')")
    expect(memoryService).toContain(".eq('conversation_id', args.conversationId)")
    expect(memoryService).toContain(".neq('id', args.excludeMessageId)")

    expect(chatService).toContain('loadRagConversationMemory')
    expect(chatService).toContain('excludeMessageId: args.messageId')
  })

  it('sanitizes and formats recent conversation messages safely', () => {
    const messages = sanitizeRagConversationMessages([
      { role: 'user', content: ' Tell me about the Pro plan. ' },
      { role: 'assistant', content: 'The Pro plan is listed in the knowledge base.' },
      { role: 'system' as never, content: 'hidden' },
      { role: 'assistant', content: '' },
    ])

    expect(messages).toEqual([
      { role: 'user', content: 'Tell me about the Pro plan.' },
      { role: 'assistant', content: 'The Pro plan is listed in the knowledge base.' },
    ])
    expect(formatRagConversationMemory(messages)).toContain('Customer: Tell me about the Pro plan.')
    expect(formatRagConversationMemory(messages)).toContain('Assistant: The Pro plan')
  })

  it('adds standalone follow-up query rewriting before retrieval', () => {
    const prompt = buildRagStandaloneQueryPrompt({
      question: 'What about old price?',
      recentMessages: [
        { role: 'user', content: 'Tell me about the Pro plan.' },
        { role: 'assistant', content: 'The Pro plan is available.' },
      ],
    })

    expect(prompt).toContain('rewrite customer follow-up questions')
    expect(prompt).toContain('Do not answer the question')
    expect(prompt).toContain('What about old price?')

    expect(chatService).toContain('rewriteRagStandaloneQuestion')
    expect(chatService).toContain('buildRagRetrievalQueries(standaloneQuestion)')
  })

  it('uses conversation memory only for reference resolution, not business truth', () => {
    const system = buildRagSystemPrompt()
    const userPrompt = buildRagUserPrompt({
      workspaceId: 'workspace-1',
      question: 'What about refund?',
      standaloneQuestion: 'What is the refund policy for the Pro plan?',
      recentMessages: [
        { role: 'user', content: 'Tell me about the Pro plan.' },
        { role: 'assistant', content: 'The Pro plan is listed in the knowledge base.' },
      ],
      retrievedChunks: [
        {
          index: 0,
          chunkId: 'chunk-1',
          sourceId: 'source-1',
          sourceTitle: 'Policy',
          similarity: 0.9,
          content: 'Refund policy: refunds are available within 7 days when listed conditions are met.',
        },
      ],
    })

    expect(system).toContain('Use recent conversation messages only to understand follow-up references')
    expect(system).toContain('Do not treat conversation memory as official business knowledge')
    expect(userPrompt).toContain('Recent conversation memory')
    expect(userPrompt).toContain('Standalone search query used for retrieval')
  })
})
