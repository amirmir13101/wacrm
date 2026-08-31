import type { Conversation } from '@/types'

export type InboxView = 'inbox' | 'ai_handoff'

/** Active handoff state comes from the conversation, not historical alerts. */
export function isAiHandoffConversation(conversation: Conversation): boolean {
  return conversation.ai_autoreply_disabled === true
}

export function filterConversationsByView(
  conversations: Conversation[],
  view: InboxView,
): Conversation[] {
  if (view === 'ai_handoff') {
    return conversations.filter(isAiHandoffConversation)
  }
  return conversations
}
