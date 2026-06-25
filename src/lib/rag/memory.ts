import { supabaseAdmin } from '@/lib/automations/admin-client'
import type { RagConversationMessage } from './types'

export const RAG_MEMORY_MESSAGE_LIMIT = 20
export const RAG_MEMORY_MESSAGE_CHARACTER_LIMIT = 1_000

export type RagConversationRole = 'user' | 'assistant'

interface MessageRow {
  readonly id: string
  readonly sender_type: string
  readonly content_text: string | null
  readonly created_at: string
}

function cleanMemoryContent(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, RAG_MEMORY_MESSAGE_CHARACTER_LIMIT)
}

function toConversationRole(senderType: string): RagConversationRole | null {
  if (senderType === 'customer') return 'user'
  if (senderType === 'agent' || senderType === 'bot') return 'assistant'
  return null
}

export function sanitizeRagConversationMessages(
  messages: ReadonlyArray<Partial<RagConversationMessage>>,
  limit = RAG_MEMORY_MESSAGE_LIMIT,
): ReadonlyArray<RagConversationMessage> {
  return messages
    .map((message) => {
      const role = message.role === 'user' || message.role === 'assistant'
        ? message.role
        : null
      const content = typeof message.content === 'string'
        ? cleanMemoryContent(message.content)
        : ''

      if (!role || !content) return null
      return { role, content } satisfies RagConversationMessage
    })
    .filter((message): message is RagConversationMessage => message !== null)
    .slice(-Math.max(1, Math.min(limit, RAG_MEMORY_MESSAGE_LIMIT)))
}

export function formatRagConversationMemory(
  messages: ReadonlyArray<RagConversationMessage>,
): string {
  return messages
    .map((message) => `${message.role === 'user' ? 'Customer' : 'Assistant'}: ${message.content}`)
    .join('\n')
}

export async function loadRagConversationMemory(args: {
  readonly workspaceId: string
  readonly conversationId: string | null | undefined
  readonly excludeMessageId?: string | null
  readonly limit?: number
}): Promise<ReadonlyArray<RagConversationMessage>> {
  if (!args.workspaceId || !args.conversationId) return []

  const admin = supabaseAdmin()
  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id, workspace_id')
    .eq('id', args.conversationId)
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (conversationError) throw new Error(conversationError.message)
  if (!conversation) return []

  const limit = Math.max(1, Math.min(args.limit ?? RAG_MEMORY_MESSAGE_LIMIT, RAG_MEMORY_MESSAGE_LIMIT))
  let query = admin
    .from('messages')
    .select('id, sender_type, content_text, created_at')
    .eq('conversation_id', args.conversationId)
    .eq('content_type', 'text')
    .not('content_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (args.excludeMessageId) {
    query = query.neq('id', args.excludeMessageId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const messages = ((data ?? []) as MessageRow[])
    .slice()
    .reverse()
    .map((row) => {
      const role = toConversationRole(row.sender_type)
      const content = row.content_text ? cleanMemoryContent(row.content_text) : ''
      if (!role || !content) return null
      return { role, content } satisfies RagConversationMessage
    })
    .filter((message): message is RagConversationMessage => message !== null)

  return sanitizeRagConversationMessages(messages, limit)
}
