import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  generateChatbotAnswer,
  getAiPlanAccess,
  isOptOutMessage,
  logAiChatbotEvent,
  retrieveRelevantChunks,
  type AiChatbotSettings,
  type AiKnowledgeChunk,
} from '@/lib/ai/chatbot'
import {
  AI_DAILY_REPLY_LIMIT,
  getAiConversationControl,
  isInCooldown,
  isSimilarAiResponse,
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
  if (existingLog) return

  const control = await getAiConversationControl({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    client: admin,
  })
  if (control?.status === 'ai_paused' || control?.status === 'needs_human') {
    await logSkip(args, 'conversation_ai_paused')
    return
  }
  if (isInCooldown(control?.last_ai_reply_at)) {
    await logSkip(args, 'rapid_reply_cooldown')
    return
  }

  const { data: settings, error: settingsError } = await admin
    .from('ai_chatbot_settings')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (settingsError || !settings) {
    await logSkip(args, settingsError ? 'settings_lookup_failed' : 'settings_missing')
    return
  }

  const chatbotSettings = settings as AiChatbotSettings
  if (!chatbotSettings.enabled || !chatbotSettings.auto_reply_enabled) {
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

  const contact = Array.isArray(conversation.contact)
    ? conversation.contact[0]
    : conversation.contact
  const phone = typeof contact?.phone === 'string' ? contact.phone : ''
  if (!phone) {
    await logSkip(args, 'contact_phone_missing')
    return
  }

  const { data: chunks, error: chunksError } = await admin
    .from('ai_knowledge_chunks')
    .select('chunk_text')
    .eq('workspace_id', args.workspaceId)

  if (chunksError) {
    await logSkip(args, 'knowledge_lookup_failed')
    return
  }

  const relevantChunks = retrieveRelevantChunks(
    customerText,
    (chunks ?? []) as Array<Pick<AiKnowledgeChunk, 'chunk_text'>>,
  )
  if (relevantChunks.length === 0) {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      status: 'skipped',
      reason: 'no_relevant_knowledge',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'no_relevant_knowledge',
      status: 'needs_human',
      client: admin,
    })
    return
  }

  const answer = await generateChatbotAnswer({
    question: customerText,
    settings: chatbotSettings,
    chunks: relevantChunks,
    workspaceId: args.workspaceId,
    requireProvider: true,
  })

  if (answer.status === 'skipped' || answer.status === 'failed' || !answer.answer) {
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
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: answer.answer,
      status: 'skipped',
      reason: answer.reason,
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: answer.reason || 'answer_not_found',
      status: chatbotSettings.handover_enabled ? 'needs_human' : 'ai_active',
      client: admin,
    })
    return
  }
  if (isSimilarAiResponse(control?.last_ai_response, answer.answer)) {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: answer.answer,
      status: 'skipped',
      reason: 'same_response_repeated',
    })
    await recordAiSkippedReason({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      reason: 'same_response_repeated',
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

async function logSkip(
  args: {
    readonly workspaceId: string | null
    readonly conversationId: string
    readonly inboundMessageId: string
    readonly customerText: string
  },
  reason: string,
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
  })
}
