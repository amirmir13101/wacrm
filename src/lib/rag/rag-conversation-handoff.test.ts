import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  RAG_BUSINESS_MISSING_HANDOFF_PROMPT,
  classifyRagCustomerIntent,
  detectRagCustomerLanguageStyle,
  deterministicGeneralReply,
  hasRagBusinessKnowledgeIntent,
  isRagHumanConfirmationNo,
  isRagHumanConfirmationYes,
  isRagHumanHelpRequest,
  ragBusinessMissingHandoffPromptFor,
} from './chat'

const chatService = readFileSync(join(process.cwd(), 'src/lib/rag/chat.ts'), 'utf8')
const webhookRoute = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'), 'utf8')
const inboxThread = readFileSync(join(process.cwd(), 'src/components/inbox/message-thread.tsx'), 'utf8')
const controlService = readFileSync(join(process.cwd(), 'src/lib/rag/conversation-controls.ts'), 'utf8')
const controlRoute = readFileSync(join(process.cwd(), 'src/app/api/rag/conversation-controls/[conversationId]/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/052_rag_conversation_handoff.sql'), 'utf8')
const dashboardStore = readFileSync(join(process.cwd(), 'src/lib/rag/dashboard-store.ts'), 'utf8')
const chatbotPage = readFileSync(join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'), 'utf8')

describe('RAG conversation routing and human handoff', () => {
  it('classifies general conversation separately from business knowledge', () => {
    expect(classifyRagCustomerIntent('Hi')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('How are you?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('I am fine')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Ap ka Kay hal hai')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Ap thk hain na?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Ap theek hain na?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Kay hal hai AP ka')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Kay hal hai')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Kya haal hai')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Sub khairiyat hai na?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Main theek hun')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('What is VPS?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('What is Acme Digital Studio?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('What is Acme Digital Studio offering?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('What are your prices?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('What is your phone number?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('Do you provide VPS hosting?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('Who is the owner of VPS Wagon?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('What VPS Wagon is selling?')).toBe('business_knowledge')
  })

  it('routes multilingual short small talk to general conversation', () => {
    expect(classifyRagCustomerIntent('آپ کا کیا حال ہے؟')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('آپ ٹھیک ہیں؟')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('मैं ठीक हूँ')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('आप कैसे हैं?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('مرحبا')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('كيف حالك؟')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Hola')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('¿Cómo estás?')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Bonjour')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Merci')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Merhaba')).toBe('general_conversation')
    expect(classifyRagCustomerIntent('Nasılsın?')).toBe('general_conversation')
  })

  it('protects multilingual business intent so it still uses KB/RAG', () => {
    expect(hasRagBusinessKnowledgeIntent('What payment methods do you accept?')).toBe(true)
    expect(classifyRagCustomerIntent('What payment methods do you accept?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('precio de planes')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('¿Cuál es tu número de teléfono?')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('رقم الهاتف')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('كم السعر؟')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('قیمت کیا ہے؟')).toBe('business_knowledge')
    expect(classifyRagCustomerIntent('प्लान की कीमत क्या है?')).toBe('business_knowledge')
  })

  it('detects direct human requests and yes/no confirmations generically', () => {
    expect(isRagHumanHelpRequest('I need human help')).toBe(true)
    expect(isRagHumanHelpRequest('connect me to support')).toBe(true)
    expect(isRagHumanHelpRequest('talk to agent')).toBe(true)
    expect(isRagHumanHelpRequest('mujhe insan se baat karni hai')).toBe(true)
    expect(isRagHumanHelpRequest('support se connect kar dein')).toBe(true)
    expect(isRagHumanConfirmationYes('yes please connect me')).toBe(true)
    expect(isRagHumanConfirmationYes('support please')).toBe(true)
    expect(isRagHumanConfirmationYes('haan')).toBe(true)
    expect(isRagHumanConfirmationYes('team se baat karwa dein')).toBe(true)
    expect(isRagHumanConfirmationNo('no not now')).toBe(true)
    expect(isRagHumanConfirmationNo('continue')).toBe(true)
    expect(isRagHumanConfirmationNo('nahi')).toBe(true)
    expect(isRagHumanConfirmationNo('abhi nahi')).toBe(true)
  })

  it('matches multilingual small-talk replies and missing-answer handoff wording', () => {
    expect(detectRagCustomerLanguageStyle('Ap ka Kay hal hai')).toBe('roman_urdu')
    expect(deterministicGeneralReply('Ap ka Kay hal hai')).toBe(
      'Main theek hoon, shukriya. Aap bataiye, main aapki kya madad kar sakta hoon?',
    )
    expect(deterministicGeneralReply('Ap thk hain na?')).toBe(
      'Main theek hoon, shukriya. Aap bataiye, main aapki kya madad kar sakta hoon?',
    )
    expect(deterministicGeneralReply('Kay hal hai AP ka')).toBe(
      'Main theek hoon, shukriya. Aap bataiye, main aapki kya madad kar sakta hoon?',
    )
    expect(deterministicGeneralReply('Kay hal hai')).toBe(
      'Main theek hoon, shukriya. Aap bataiye, main aapki kya madad kar sakta hoon?',
    )
    expect(deterministicGeneralReply('Sub khairiyat hai na?')).toBe(
      'Main theek hoon, shukriya. Aap bataiye, main aapki kya madad kar sakta hoon?',
    )
    expect(deterministicGeneralReply('Main theek hun')).toBe(
      'Achha, shukriya. Aapko kis cheez mein madad chahiye?',
    )
    expect(deterministicGeneralReply('I am fine')).toBe('Glad to hear that. How can I help you today?')
    expect(deterministicGeneralReply('Ap thk hain na?')).not.toBe(ragBusinessMissingHandoffPromptFor('Ap thk hain na?'))
    expect(deterministicGeneralReply('Kay hal hai AP ka')).not.toBe(ragBusinessMissingHandoffPromptFor('Kay hal hai AP ka'))
    expect(deterministicGeneralReply('مرحبا')).toBe('أنا بخير، شكرًا. كيف يمكنني مساعدتك؟')
    expect(deterministicGeneralReply('Hola')).toBe('Hola, estoy bien. ¿Cómo puedo ayudarte?')
    expect(deterministicGeneralReply('Bonjour')).toBe('Bonjour, je vais bien. Comment puis-je vous aider ?')
    expect(ragBusinessMissingHandoffPromptFor('Ap mujhe bata sakte hain?')).toBe(
      'Mere paas is waqt yeh exact detail nahi hai. Kya main aapko team member se connect kar doon?',
    )
    expect(ragBusinessMissingHandoffPromptFor('What is that?')).toBe(RAG_BUSINESS_MISSING_HANDOFF_PROMPT)
  })

  it('keeps business RAG retrieval intact and wraps only the missing-answer result', () => {
    expect(chatService).toContain('buildRagRetrievalQueries(standaloneQuestion)')
    expect(chatService).toContain('retrieveRagChunksForQueries')
    expect(chatService).toContain('match_rag_knowledge_chunks')
    expect(chatService).toContain('RAG_BUSINESS_MISSING_HANDOFF_PROMPT')
    expect(chatService).toContain("action: 'await_human_confirmation'")
    expect(RAG_BUSINESS_MISSING_HANDOFF_PROMPT).toBe(
      "I don't have that exact detail right now. Would you like me to connect you with a team member?",
    )
  })

  it('adds general provider answers without exposing business facts through the general path', () => {
    expect(chatService).toContain('answerGeneralConversation')
    expect(chatService).toContain('Answer only general/small-talk/simple knowledge questions.')
    expect(chatService).toContain('Do not invent business-specific facts')
    expect(chatService).toContain("Match the customer's language and writing style")
    expect(chatService).toContain('customer language and writing style')
    expect(chatService).toContain('AI provider is not configured yet.')
    expect(chatService).toContain('deterministicGeneralReply')
    expect(chatService).toContain('isSimpleArithmetic')
    expect(chatService).toContain('hasRagBusinessKnowledgeIntent(clean)')
  })

  it('stores pending human requests without pausing AI until owner acceptance', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.rag_conversation_controls')
    expect(migration).toContain("human_request_status IN ('none', 'requested', 'accepted', 'rejected')")
    expect(controlService).toContain("action === 'request_human'")
    expect(controlService).toContain('patch.ai_paused = false')
    expect(controlService).toContain("action === 'accept_human'")
    expect(controlService).toContain('patch.ai_paused = true')
    expect(controlService).toContain("action === 'reject_human'")
    expect(controlService).toContain("action === 'ai_active'")
    expect(controlRoute).toContain("requireRagPermission('reply_to_conversations')")
  })

  it('shows Inbox actions for pending and accepted human handoff', () => {
    expect(inboxThread).toContain('Human support requested')
    expect(inboxThread).toContain('Accept Human')
    expect(inboxThread).toContain('Reject Human')
    expect(inboxThread).toContain('AI Active')
    expect(inboxThread).toContain('AI Pause')
    expect(inboxThread).toContain('AI will keep answering safely until a workspace user clicks Accept Human.')
  })

  it('prevents auto replies after accepted human handoff but not while pending', () => {
    expect(webhookRoute).toContain("result.fallbackReason === 'ai_paused_for_human'")
    expect(chatService).toContain("fallbackReason: 'human_request_pending_owner_acceptance'")
    expect(chatService).toContain('aiPaused: nextControl?.aiPaused ?? false')
  })

  it('replaces customer-facing missing-knowledge wording in settings defaults', () => {
    expect(dashboardStore).toContain(RAG_BUSINESS_MISSING_HANDOFF_PROMPT)
    expect(chatbotPage).toContain(RAG_BUSINESS_MISSING_HANDOFF_PROMPT)
    expect(dashboardStore).not.toContain("fallback_message: args.fallbackMessage.trim() || 'I do not see that information in the current knowledge base.'")
    expect(chatbotPage).not.toContain('placeholder="I do not see that information in the current knowledge base."')
  })
})
