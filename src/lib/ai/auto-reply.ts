import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  aiMessageOfferedHumanHandoff,
  generateChatbotAnswer,
  getAiPlanAccess,
  isHumanHandoffConfirmation,
  isHumanHandoffRequest,
  isOptOutMessage,
  logAiChatbotEvent,
  type AiChatbotSettings,
} from '@/lib/ai/chatbot'
import { hybridRetrieveKnowledge } from '@/lib/ai/retrieval'
import {
  AI_HUMAN_REPLY_PAUSE_SECONDS,
  AI_DAILY_REPLY_LIMIT,
  getAiConversationControl,
  recordAiReply,
  recordAiSkippedReason,
} from '@/lib/ai/conversation-controls'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'

export async function maybeHandleAiAutoReply(args: {
  readonly workspaceId: string | null
  readonly userId: string
  readonly conversationId: string
  readonly inboundMessageId: string
  readonly customerText: string
}): Promise<void> {
  if (!args.workspaceId) return
  const customerText = args.customerText.trim()
  if (!customerText) {
    await logSkip(args, 'empty_customer_text')
    return
  }
  if (isOptOutMessage(customerText)) {
    await logSkip(args, 'opt_out_message')
    return
  }

  const admin = supabaseAdmin()

  const { data: existingLog } = await admin
    .from('ai_chatbot_logs')
    .select('id')
    .eq('message_id', args.inboundMessageId)
    .maybeSingle()
  if (existingLog) {
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'duplicate_inbound_message',
      client: admin,
    })
    return
  }

  const { data: settings, error: settingsError } = await admin
    .from('ai_chatbot_settings')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  const chatbotSettings = settings as AiChatbotSettings | null
  const control = await getAiConversationControl({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    client: admin,
  })
  if (control?.status === 'ai_paused') {
    await logSkip(args, 'conversation_ai_paused', 'ai_paused')
    return
  }
  if (control?.status === 'needs_human') {
    await logSkip(args, 'conversation_needs_human', 'needs_human')
    return
  }

  const humanRequest =
    isHumanHandoffRequest(customerText) ||
    (isHumanHandoffConfirmation(customerText) && aiMessageOfferedHumanHandoff(control?.last_ai_response))
  if (humanRequest) {
    const handoffMessage =
      chatbotSettings?.handover_message?.trim() ||
      "I'll connect you with our team so they can help you better."

    const { data: conversation } = await admin
      .from('conversations')
      .select('id, contact:contacts(phone)')
      .eq('id', args.conversationId)
      .eq('workspace_id', args.workspaceId)
      .maybeSingle()
    const contact = Array.isArray(conversation?.contact)
      ? conversation?.contact[0]
      : conversation?.contact
    const phone = typeof contact?.phone === 'string' ? contact.phone : ''

    if (phone) {
      await sendConfiguredAiMessage({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        inboundMessageId: args.inboundMessageId,
        customerText,
        phone,
        text: handoffMessage,
        status: 'fallback',
        reason: 'human_handoff_requested',
        controlStatus: 'needs_human',
        controlReason: 'human_handoff_requested',
        client: admin,
      })
      return
    }

    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      status: 'skipped',
      reason: 'human_handoff_requested',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'human_handoff_requested',
      status: 'needs_human',
      client: admin,
    })
    return
  }

  if (settingsError || !settings) {
    await logSkip(args, settingsError ? 'settings_lookup_failed' : 'settings_missing')
    return
  }

  const activeChatbotSettings = settings as AiChatbotSettings
  if (!activeChatbotSettings.enabled || !activeChatbotSettings.auto_reply_enabled) {
    await logSkip(args, 'chatbot_disabled')
    return
  }

  const plan = await getAiPlanAccess(args.workspaceId)
  if (!plan.canUseAutoReply) {
    await logSkip(args, 'plan_not_active_pro')
    return
  }

  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)
  const { count: dailyReplyCount, error: dailyReplyError } = await admin
    .from('ai_chatbot_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .in('status', ['answered', 'fallback'])
    .not('conversation_id', 'is', null)
    .gte('created_at', dayStart.toISOString())

  if (dailyReplyError) {
    await logSkip(args, 'daily_reply_limit_lookup_failed')
    return
  }
  if ((dailyReplyCount ?? 0) >= AI_DAILY_REPLY_LIMIT) {
    await logSkip(args, 'daily_reply_limit_reached')
    return
  }

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id, status, assigned_agent_id, contact:contacts(phone)')
    .eq('id', args.conversationId)
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (conversationError || !conversation) {
    await logSkip(args, conversationError ? 'conversation_lookup_failed' : 'conversation_missing')
    return
  }
  if (conversation.status === 'closed') {
    await logSkip(args, 'conversation_closed')
    return
  }
  if (conversation.assigned_agent_id) {
    await logSkip(args, 'conversation_assigned_to_human')
    return
  }

  const humanReplyCutoff = new Date(Date.now() - AI_HUMAN_REPLY_PAUSE_SECONDS * 1000).toISOString()
  const { data: recentHumanMessages, error: recentHumanError } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', args.conversationId)
    .eq('sender_type', 'agent')
    .gte('created_at', humanReplyCutoff)
    .limit(1)

  if (recentHumanError) {
    await logSkip(args, 'human_reply_lookup_failed')
    return
  }
  if ((recentHumanMessages ?? []).length > 0) {
    await logSkip(args, 'human_replied_recently')
    return
  }

  const contact = Array.isArray(conversation.contact)
    ? conversation.contact[0]
    : conversation.contact
  const phone = typeof contact?.phone === 'string' ? contact.phone : ''
  if (!phone) {
    await logSkip(args, 'contact_phone_missing')
    return
  }

  let retrieval: Awaited<ReturnType<typeof hybridRetrieveKnowledge>>
  try {
    const conversationContext = await fetchConversationContext({
      conversationId: args.conversationId,
      inboundMessageId: args.inboundMessageId,
      client: admin,
    })
    retrieval = await hybridRetrieveKnowledge({
      workspaceId: args.workspaceId,
      question: customerText,
      contextualQuery: conversationContext,
      client: admin,
    })
  } catch {
    await logSkip(args, 'knowledge_lookup_failed')
    return
  }

  if (retrieval.fallbackReason || retrieval.chunks.length === 0) {
    const fallbackMessage =
      activeChatbotSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message
    await sendConfiguredAiMessage({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      inboundMessageId: args.inboundMessageId,
      customerText,
      phone,
      text: fallbackMessage,
      status: 'fallback',
      reason: retrieval.fallbackReason ?? 'no_relevant_knowledge',
      controlStatus: 'ai_active',
      controlReason: retrieval.fallbackReason ?? 'no_relevant_knowledge',
      client: admin,
    })
    return
  }

  const answer = await generateChatbotAnswer({
    question: customerText,
    settings: activeChatbotSettings,
    chunks: retrieval.chunks,
    workspaceId: args.workspaceId,
    requireProvider: true,
    calculation: retrieval.calculation,
    conversationContext: retrieval.analysis.contextualQuery,
  })

  if (answer.status === 'skipped' || answer.status === 'failed' || !answer.answer) {
    const handoffMessage = activeChatbotSettings.handover_message.trim()
    if (activeChatbotSettings.handover_enabled && handoffMessage) {
      await sendConfiguredAiMessage({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        inboundMessageId: args.inboundMessageId,
        customerText,
        phone,
        text: handoffMessage,
        status: 'fallback',
        reason: answer.reason || 'human_handoff',
        controlStatus: 'needs_human',
        controlReason: answer.reason || 'human_handoff',
        client: admin,
      })
      return
    }
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      status: answer.status,
      reason: answer.reason,
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: answer.reason,
      status: answer.reason === 'ai_provider_missing' ? 'ai_active' : 'needs_human',
      client: admin,
    })
    return
  }
  if (answer.status === 'fallback') {
    await sendConfiguredAiMessage({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      inboundMessageId: args.inboundMessageId,
      customerText,
      phone,
      text: answer.answer,
      status: 'fallback',
      reason: answer.reason || 'answer_not_found',
      controlStatus: 'ai_active',
      controlReason: answer.reason || 'answer_not_found',
      client: admin,
    })
    return
  }

  const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
    id: string
    phone_number_id: string
    access_token: string
  }>({
    workspaceId: args.workspaceId,
    columns: '*',
  })

  if (configError || !config) {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: answer.answer,
      status: 'skipped',
      reason: configError ? 'whatsapp_config_error' : 'whatsapp_config_missing',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: configError ? 'whatsapp_config_error' : 'whatsapp_config_missing',
      status: 'needs_human',
      client: admin,
    })
    return
  }

  try {
    const result = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      to: phone,
      text: answer.answer,
    })

    const { error: insertError } = await admin.from('messages').insert({
      conversation_id: args.conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: answer.answer,
      message_id: result.messageId,
      status: 'sent',
    })

    if (insertError) {
      await logAiChatbotEvent({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        messageId: args.inboundMessageId,
        userMessage: customerText,
        aiResponse: answer.answer,
        status: 'failed',
        reason: 'message_insert_failed',
      })
      await recordAiSkippedReason({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        reason: 'message_insert_failed',
        status: 'needs_human',
        client: admin,
      })
      return
    }

    await admin
      .from('conversations')
      .update({
        last_message_text: answer.answer,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId)

    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: answer.answer,
      status: answer.status,
      reason: answer.reason,
    })
    await recordAiReply({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      response: answer.answer,
      client: admin,
    })
  } catch {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: answer.answer,
      status: 'failed',
      reason: 'whatsapp_send_failed',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'whatsapp_send_failed',
      status: 'needs_human',
      client: admin,
    })
  }
}

async function sendConfiguredAiMessage(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly inboundMessageId: string
  readonly customerText: string
  readonly phone: string
  readonly text: string
  readonly status: 'answered' | 'fallback'
  readonly reason: string
  readonly controlStatus: 'ai_active' | 'needs_human'
  readonly controlReason: string
  readonly client: ReturnType<typeof supabaseAdmin>
}): Promise<boolean> {
  const text = args.text.trim()
  if (!text) return false

  const { config, error: configError } = await findWorkspaceWhatsAppConfig<{
    id: string
    phone_number_id: string
    access_token: string
  }>({
    workspaceId: args.workspaceId,
    columns: '*',
  })

  if (configError || !config) {
    const reason = configError ? 'whatsapp_config_error' : 'whatsapp_config_missing'
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: args.customerText,
      aiResponse: text,
      status: 'skipped',
      reason,
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason,
      status: 'needs_human',
      client: args.client,
    })
    return false
  }

  try {
    const result = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      to: args.phone,
      text,
    })

    const { error: insertError } = await args.client.from('messages').insert({
      conversation_id: args.conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: text,
      message_id: result.messageId,
      status: 'sent',
    })

    if (insertError) {
      await logAiChatbotEvent({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        messageId: args.inboundMessageId,
        userMessage: args.customerText,
        aiResponse: text,
        status: 'failed',
        reason: 'message_insert_failed',
      })
      await recordAiSkippedReason({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        reason: 'message_insert_failed',
        status: 'needs_human',
        client: args.client,
      })
      return false
    }

    await args.client
      .from('conversations')
      .update({
        last_message_text: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId)

    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: args.customerText,
      aiResponse: text,
      status: args.status,
      reason: args.reason,
    })
    await recordAiReply({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      response: text,
      client: args.client,
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: args.controlReason,
      status: args.controlStatus,
      client: args.client,
    })
    return true
  } catch {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: args.customerText,
      aiResponse: text,
      status: 'failed',
      reason: 'whatsapp_send_failed',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'whatsapp_send_failed',
      status: 'needs_human',
      client: args.client,
    })
    return false
  }
}

async function fetchConversationContext(args: {
  readonly conversationId: string
  readonly inboundMessageId: string
  readonly client: ReturnType<typeof supabaseAdmin>
}): Promise<string | null> {
  const { data } = await args.client
    .from('messages')
    .select('id, sender_type, content_text, created_at')
    .eq('conversation_id', args.conversationId)
    .neq('id', args.inboundMessageId)
    .not('content_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3)

  const context = (data ?? [])
    .filter((message) => typeof message.content_text === 'string' && message.content_text.trim())
    .reverse()
    .map((message) => {
      const sender = message.sender_type === 'customer' ? 'Customer' : 'Assistant'
      return `${sender}: ${message.content_text.trim().slice(0, 500)}`
    })

  return context.length > 0 ? context.join('\n') : null
}

async function logSkip(
  args: {
    readonly workspaceId: string | null
    readonly conversationId: string
    readonly inboundMessageId: string
    readonly customerText: string
  },
  reason: string,
  status?: 'ai_active' | 'ai_paused' | 'needs_human',
): Promise<void> {
  if (!args.workspaceId) return
  await logAiChatbotEvent({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    messageId: args.inboundMessageId,
    userMessage: args.customerText,
    status: 'skipped',
    reason,
  })
  await recordAiSkippedReason({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    reason,
    status,
  })
}
