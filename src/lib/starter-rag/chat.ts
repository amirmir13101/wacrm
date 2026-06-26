import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage,
  type UIMessage,
} from 'ai'
import { z } from 'zod'

import { findStarterRagRelevantContent } from './embedding'
import { createStarterRagAIProvider } from './provider'
import { addStarterRagResource } from './resources'

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

export function getReadableStarterRagChatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  if (error.message.includes('ECONNREFUSED')) {
    return 'Database is not reachable. Please start Docker Desktop and the pgvector container.'
  }

  if (error.message.includes('API key')) {
    return 'Starter RAG provider API key is not configured.'
  }

  return error.message
}

export async function streamStarterRagChat(messages: UIMessage[]) {
  const { chatLanguageModel } = await createStarterRagAIProvider()

  return streamText({
    model: chatLanguageModel,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: STARTER_RAG_MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(5),
    onError: ({ error }) => {
      console.error('Starter RAG chat stream failed:', error)
    },
    system: STARTER_RAG_SYSTEM_PROMPT,
    tools: {
      addResource: tool({
        description: `Add a resource to the knowledge base.
If the user provides business knowledge or source material to store, use this tool without asking for confirmation.`,
        inputSchema: z.object({
          content: z.string().describe('the content or resource to add to the knowledge base'),
        }),
        execute: async ({ content }) => addStarterRagResource({ content }),
      }),
      getInformation: tool({
        description: 'Get relevant information from the knowledge base to answer a question.',
        inputSchema: z.object({
          question: z.string().describe("the user's question"),
        }),
        execute: async ({ question }) => findStarterRagRelevantContent(question),
      }),
    },
  })
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

  const { chatLanguageModel, providerName, chatModel } = await createStarterRagAIProvider()
  const result = await generateText({
    model: chatLanguageModel,
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
