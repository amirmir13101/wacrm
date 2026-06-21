import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  aiMessageOfferedHumanHandoff,
  generateChatbotAnswer,
  generateSimpleFullKnowledgeAnswer,
  getAiPlanAccess,
  isHumanHandoffConfirmation,
  isHumanHandoffRequest,
  isOptOutMessage,
  loadFullKnowledgeAnswerMode,
  logAiChatbotEvent,
  type AiChatbotSettings,
} from '@/lib/ai/chatbot'
import { detectLanguage, type DetectedLanguage } from '@/lib/ai/language'
import {
  buildMemoryRetrievalContext,
  formatMemoryContext,
  loadContactMemory,
  summarizeConversation,
} from '@/lib/ai/memory'
import { resolveLanguageSettings } from '@/lib/ai/provider'
import { resolveMemorySettings, type AiMemorySettings } from '@/lib/ai/provider'
import { hybridRetrieveKnowledge } from '@/lib/ai/retrieval'
import { translateFromEnglish, translateToEnglish } from '@/lib/ai/translation'
import { logKnowledgeGap } from '@/lib/ai/knowledge-gaps'
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
      .select('id, contact_id, contact:contacts(phone)')
      .eq('id', args.conversationId)
      .eq('workspace_id', args.workspaceId)
      .maybeSingle()
    const contact = Array.isArray(conversation?.contact)
      ? conversation?.contact[0]
      : conversation?.contact
    const phone = typeof contact?.phone === 'string' ? contact.phone : ''
    const contactId = typeof conversation?.contact_id === 'string' ? conversation.contact_id : ''

    if (phone) {
      const memorySettings = await resolveMemorySettings(args.workspaceId).catch(() => ({
        memoryEnabled: true,
        memorySummarizeAfter: 5,
        memoryRetentionDays: 90,
        memoryClearOnHuman: false,
      }))
      await sendConfiguredAiMessage({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        contactId,
        inboundMessageId: args.inboundMessageId,
        customerText,
        phone,
        text: handoffMessage,
        status: 'fallback',
        reason: 'human_handoff_requested',
        controlStatus: 'needs_human',
        controlReason: 'human_handoff_requested',
        client: admin,
        memorySettings,
        summaryTrigger: 'needs_human',
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
    .select('id, status, assigned_agent_id, contact_id, contact:contacts(phone)')
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
  const contactId = typeof conversation.contact_id === 'string' ? conversation.contact_id : ''
  const memorySettings = await resolveMemorySettings(args.workspaceId).catch(() => ({
    memoryEnabled: true,
    memorySummarizeAfter: 5,
    memoryRetentionDays: 90,
    memoryClearOnHuman: false,
  }))
  const contactMemory = memorySettings.memoryEnabled && contactId
    ? await loadContactMemory(args.workspaceId, contactId)
    : null
  const memoryContext = contactMemory ? formatMemoryContext(contactMemory) : null
  const multilingual = await prepareMultilingualQuestion({
    workspaceId: args.workspaceId,
    customerText,
  })
  const retrievalQuestion = multilingual.questionForRetrieval
  try {
    const conversationContext = await fetchConversationContext({
      conversationId: args.conversationId,
      inboundMessageId: args.inboundMessageId,
      client: admin,
    })
    const fullKnowledge = await loadFullKnowledgeAnswerMode({
      workspaceId: args.workspaceId,
      client: admin,
    })
    if (fullKnowledge.mode === 'simple_full_knowledge') {
      const simpleAnswer = await generateSimpleFullKnowledgeAnswer({
        question: retrievalQuestion,
        settings: activeChatbotSettings,
        knowledge: fullKnowledge.content,
        workspaceId: args.workspaceId,
        requireProvider: true,
        conversationContext,
        memoryContext,
        responseIsRTL: multilingual.responseLanguage?.isRTL,
        gapContext: {
          originalQuestion: multilingual.originalQuestion,
          detectedLanguage: multilingual.detectedLanguage?.code,
          channel: 'whatsapp',
          conversationId: args.conversationId,
          contactId,
        },
      })

      const localizedSimpleAnswer = await localizeAnswerForCustomer({
        workspaceId: args.workspaceId,
        answer: simpleAnswer.answer,
        responseLanguage: multilingual.responseLanguage,
      })

      const simpleText = simpleAnswer.status === 'answered' && localizedSimpleAnswer
        ? localizedSimpleAnswer
        : simpleAnswer.answer || activeChatbotSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message

      await sendConfiguredAiMessage({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        contactId,
        inboundMessageId: args.inboundMessageId,
        customerText,
        phone,
        text: simpleText,
        status: simpleAnswer.status === 'answered' ? 'answered' : 'fallback',
        reason: simpleAnswer.reason,
        controlStatus: 'ai_active',
        controlReason: simpleAnswer.reason,
        client: admin,
        memorySettings,
        summaryTrigger: simpleAnswer.status === 'answered' ? 'after_ai_reply' : 'fallback',
      })
      return
    }
    retrieval = await hybridRetrieveKnowledge({
      workspaceId: args.workspaceId,
      question: retrievalQuestion,
      contextualQuery: conversationContext,
      memoryContext: memorySettings.memoryEnabled ? buildMemoryRetrievalContext(contactMemory) : null,
      client: admin,
    })
  } catch {
    await logSkip(args, 'knowledge_lookup_failed')
    return
  }

  if (retrieval.fallbackReason || retrieval.chunks.length === 0) {
    const fallbackMessage =
      activeChatbotSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message
    await logKnowledgeGap({
      workspaceId: args.workspaceId,
      question: retrievalQuestion,
      originalQuestion: multilingual.originalQuestion,
      detectedLanguage: multilingual.detectedLanguage?.code,
      fallbackReason: retrieval.fallbackReason ?? 'no_relevant_knowledge',
      retrievalScore: retrieval.evidence[0]?.finalScore ?? null,
      chunkCountRetrieved: retrieval.evidence.length,
      embeddingUsed: retrieval.evidence.some((candidate) => candidate.vectorScore > 0),
      channel: 'whatsapp',
      conversationId: args.conversationId,
      contactId,
    }, admin)
    await sendConfiguredAiMessage({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      contactId,
      inboundMessageId: args.inboundMessageId,
      customerText,
      phone,
      text: fallbackMessage,
      status: 'fallback',
      reason: retrieval.fallbackReason ?? 'no_relevant_knowledge',
      controlStatus: 'ai_active',
      controlReason: retrieval.fallbackReason ?? 'no_relevant_knowledge',
      client: admin,
      memorySettings,
      summaryTrigger: 'fallback',
    })
    return
  }

  const answer = await generateChatbotAnswer({
    question: retrievalQuestion,
    settings: activeChatbotSettings,
    chunks: retrieval.chunks,
    workspaceId: args.workspaceId,
    requireProvider: true,
    calculation: retrieval.calculation,
    conversationContext: retrieval.analysis.contextualQuery,
    memoryContext,
    responseIsRTL: multilingual.responseLanguage?.isRTL,
    gapContext: {
      retrievalScore: retrieval.evidence[0]?.finalScore ?? null,
      chunkCountRetrieved: retrieval.evidence.length,
      embeddingUsed: retrieval.evidence.some((candidate) => candidate.vectorScore > 0),
      originalQuestion: multilingual.originalQuestion,
      detectedLanguage: multilingual.detectedLanguage?.code,
      channel: 'whatsapp',
      conversationId: args.conversationId,
      contactId,
    },
  })

  const finalAnswer = await localizeAnswerForCustomer({
    workspaceId: args.workspaceId,
    answer: answer.answer,
    responseLanguage: multilingual.responseLanguage,
  })

  if (answer.status === 'skipped' || answer.status === 'failed' || !answer.answer) {
    const safeFallback = activeChatbotSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message
    await sendConfiguredAiMessage({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      contactId,
      inboundMessageId: args.inboundMessageId,
      customerText,
      phone,
      text: safeFallback,
      status: 'fallback',
      reason: answer.reason || 'ai_provider_unavailable',
      controlStatus: 'ai_active',
      controlReason: answer.reason || 'ai_provider_unavailable',
      client: admin,
      memorySettings,
      summaryTrigger: 'fallback',
    })
    return
  }
  if (answer.status === 'fallback') {
    await sendConfiguredAiMessage({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      contactId,
      inboundMessageId: args.inboundMessageId,
      customerText,
      phone,
      text: finalAnswer,
      status: 'fallback',
      reason: answer.reason || 'answer_not_found',
      controlStatus: 'ai_active',
      controlReason: answer.reason || 'answer_not_found',
      client: admin,
      memorySettings,
      summaryTrigger: 'fallback',
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
      aiResponse: finalAnswer,
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
      text: finalAnswer,
    })

    const { error: insertError } = await admin.from('messages').insert({
      conversation_id: args.conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: finalAnswer,
      message_id: result.messageId,
      status: 'sent',
    })

    if (insertError) {
      await logAiChatbotEvent({
        workspaceId: args.workspaceId,
        conversationId: args.conversationId,
        messageId: args.inboundMessageId,
        userMessage: customerText,
        aiResponse: finalAnswer,
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
        last_message_text: finalAnswer,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId)

    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: finalAnswer,
      status: answer.status,
      reason: answer.reason,
    })
    await recordAiReply({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      response: finalAnswer,
      client: admin,
    })
    triggerMemorySummarization({
      workspaceId: args.workspaceId,
      contactId,
      conversationId: args.conversationId,
      client: admin,
      settings: memorySettings,
      trigger: 'after_ai_reply',
    })
  } catch {
    await logAiChatbotEvent({
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.inboundMessageId,
      userMessage: customerText,
      aiResponse: finalAnswer,
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

async function prepareMultilingualQuestion(args: {
  readonly workspaceId: string
  readonly customerText: string
}): Promise<{
  readonly questionForRetrieval: string
  readonly originalQuestion: string | null
  readonly detectedLanguage: DetectedLanguage | null
  readonly responseLanguage: DetectedLanguage | null
}> {
  const settings = await resolveLanguageSettings(args.workspaceId).catch(() => ({
    multilingualEnabled: false,
    defaultResponseLanguage: 'auto',
    supportedLanguages: null,
  }))
  if (!settings.multilingualEnabled) {
    return { questionForRetrieval: args.customerText, originalQuestion: null, detectedLanguage: null, responseLanguage: null }
  }
  const detected = detectLanguage(args.customerText)
  if (!detected.needsTranslation || detected.confidence < 0.6 || !languageAllowed(detected.code, settings.supportedLanguages)) {
    return { questionForRetrieval: args.customerText, originalQuestion: null, detectedLanguage: detected, responseLanguage: null }
  }
  const translated = await translateToEnglish(args.customerText, detected, args.workspaceId)
  const responseLanguage = settings.defaultResponseLanguage === 'auto'
    ? detected
    : settings.defaultResponseLanguage === 'en'
      ? null
      : { ...detected, code: settings.defaultResponseLanguage, needsTranslation: true }
  return {
    questionForRetrieval: translated.success ? translated.translatedText : args.customerText,
    originalQuestion: args.customerText,
    detectedLanguage: detected,
    responseLanguage,
  }
}

async function localizeAnswerForCustomer(args: {
  readonly workspaceId: string
  readonly answer: string
  readonly responseLanguage: DetectedLanguage | null
}): Promise<string> {
  if (!args.responseLanguage || !args.answer.trim()) return args.answer
  const translated = await translateFromEnglish(args.answer, args.responseLanguage, args.workspaceId)
  if (translated.success) return translated.translatedText
  return `${args.answer}\n\nNote: English response - translation temporarily unavailable.`
}

function languageAllowed(code: string, supportedLanguages: readonly string[] | null): boolean {
  return !supportedLanguages || supportedLanguages.includes(code)
}

function triggerMemorySummarization(args: {
  readonly workspaceId: string
  readonly contactId: string | null
  readonly conversationId: string
  readonly client: ReturnType<typeof supabaseAdmin>
  readonly settings?: AiMemorySettings
  readonly trigger: 'after_ai_reply' | 'fallback' | 'needs_human'
}): void {
  if (!args.contactId || args.settings?.memoryEnabled === false) return
  const contactId = args.contactId
  void (async () => {
    try {
      const settings = args.settings ?? await resolveMemorySettings(args.workspaceId)
      if (!settings.memoryEnabled) return
      if (!await shouldSummarizeConversation({ ...args, settings })) return
      const messages = await fetchConversationMessagesForMemory({
        conversationId: args.conversationId,
        client: args.client,
      })
      if (messages.length === 0) return
      console.info('[ai-memory] summarization triggered', {
        workspace_id: args.workspaceId,
        contact_id: contactId,
      })
      await summarizeConversation(args.workspaceId, contactId, args.conversationId, messages, settings)
    } catch {
      // Memory must never block or break WhatsApp replies.
    }
  })()
}

async function shouldSummarizeConversation(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly client: ReturnType<typeof supabaseAdmin>
  readonly settings: AiMemorySettings
  readonly trigger: 'after_ai_reply' | 'fallback' | 'needs_human'
}): Promise<boolean> {
  if (args.trigger === 'fallback' || args.trigger === 'needs_human') return true
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString()
  const [{ count: recentSummaryCount }, { count: aiMessageCount }] = await Promise.all([
    args.client
      .from('ai_conversation_summaries')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .eq('conversation_id', args.conversationId)
      .gte('summarized_at', since),
    args.client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', args.conversationId)
      .eq('sender_type', 'bot'),
  ])
  if ((recentSummaryCount ?? 0) > 0) return false
  return (aiMessageCount ?? 0) >= args.settings.memorySummarizeAfter
}

async function fetchConversationMessagesForMemory(args: {
  readonly conversationId: string
  readonly client: ReturnType<typeof supabaseAdmin>
}): Promise<Array<{ sender_type: string | null; content_text: string | null; created_at: string | null }>> {
  const { data } = await args.client
    .from('messages')
    .select('sender_type, content_text, created_at')
    .eq('conversation_id', args.conversationId)
    .not('content_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []).reverse()
}

async function sendConfiguredAiMessage(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly contactId?: string | null
  readonly inboundMessageId: string
  readonly customerText: string
  readonly phone: string
  readonly text: string
  readonly status: 'answered' | 'fallback'
  readonly reason: string
  readonly controlStatus: 'ai_active' | 'needs_human'
  readonly controlReason: string
  readonly client: ReturnType<typeof supabaseAdmin>
  readonly memorySettings?: AiMemorySettings
  readonly summaryTrigger?: 'after_ai_reply' | 'fallback' | 'needs_human'
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
    triggerMemorySummarization({
      workspaceId: args.workspaceId,
      contactId: args.contactId ?? null,
      conversationId: args.conversationId,
      client: args.client,
      settings: args.memorySettings,
      trigger: args.summaryTrigger ?? (args.controlStatus === 'needs_human' ? 'needs_human' : args.status === 'fallback' ? 'fallback' : 'after_ai_reply'),
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
