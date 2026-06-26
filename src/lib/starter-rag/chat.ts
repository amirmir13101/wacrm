import { generateText, stepCountIs, tool, type ModelMessage } from 'ai'
import { z } from 'zod'

import { findStarterRagRelevantContent } from './embedding'
import { createStarterRagAIProvider } from './provider'

export const STARTER_RAG_MAX_OUTPUT_TOKENS = 160
export const STARTER_RAG_SYSTEM_PROMPT = `You are a lightweight knowledge-base chatbot.
Check the knowledge base with the getInformation tool before answering any user question.
Answer only using information returned by tool calls.
If no relevant information is returned, say that the information is not available in the knowledge base.
Do not guess, infer missing business policies, or use general model memory.`

export interface StarterRagChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface StarterRagChatResult {
  readonly answer: string
  readonly status: 'answered' | 'fallback' | 'provider_error'
  readonly provider: string
  readonly chatModel: string
}

function normalizeMessages(messages: ReadonlyArray<StarterRagChatMessage>): ModelMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
}

function cleanAnswer(value: string): string {
  return value.trim() || 'The information is not available in the knowledge base.'
}

function answerStatus(answer: string): StarterRagChatResult['status'] {
  const lower = answer.toLowerCase()
  if (
    lower.includes('not available in the knowledge base') ||
    lower.includes('do not see that information') ||
    lower.includes("don't have that information")
  ) {
    return 'fallback'
  }
  return 'answered'
}

export async function answerStarterRagQuestion(
  messages: ReadonlyArray<StarterRagChatMessage>,
): Promise<StarterRagChatResult> {
  const normalizedMessages = normalizeMessages(messages)
  const lastUserMessage = [...normalizedMessages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) {
    throw new Error('Question is required.')
  }

  const { provider, providerName, chatModel } = await createStarterRagAIProvider()
  const result = await generateText({
    model: provider(chatModel),
    messages: normalizedMessages,
    maxOutputTokens: STARTER_RAG_MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(5),
    system: STARTER_RAG_SYSTEM_PROMPT,
    tools: {
      getInformation: tool({
        description: 'Get relevant information from the knowledge base to answer a question.',
        inputSchema: z.object({
          question: z.string().describe("the user's question"),
        }),
        execute: async ({ question }) => findStarterRagRelevantContent(question),
      }),
    },
  })

  const answer = cleanAnswer(result.text)

  return {
    answer,
    status: answerStatus(answer),
    provider: providerName,
    chatModel,
  }
}
