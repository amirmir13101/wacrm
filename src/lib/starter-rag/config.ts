import { chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { z } from 'zod'

export const STARTER_RAG_CONFIG_FILE = '.starter-rag-config.json'
export const STARTER_RAG_DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5433/rag_test'
export const STARTER_RAG_DEFAULT_PROVIDER = 'openrouter'
export const STARTER_RAG_DEFAULT_CHAT_MODEL = 'openai/gpt-4o-mini'
export const STARTER_RAG_DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

export type StarterRagProviderType = 'openai' | 'openrouter'

const starterRagConfigSchema = z.object({
  AI_PROVIDER: z.enum(['openai', 'openrouter']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  CHAT_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
})

export type StarterRagConfigFile = z.infer<typeof starterRagConfigSchema>

export interface StarterRagSettingsInput {
  readonly provider?: StarterRagProviderType
  readonly apiKey?: string
  readonly databaseUrl?: string
  readonly chatModel?: string
  readonly embeddingModel?: string
}

export interface StarterRagEffectiveSettings {
  readonly provider: StarterRagProviderType
  readonly apiKey: string
  readonly databaseUrl: string
  readonly chatModel: string
  readonly embeddingModel: string
}

export interface StarterRagSettingsStatus {
  readonly provider: StarterRagProviderType
  readonly apiKeyConfigured: boolean
  readonly maskedKey: string | null
  readonly databaseUrlConfigured: boolean
  readonly databaseUrlPreview: string
  readonly chatModel: string
  readonly embeddingModel: string
}

export function starterRagConfigPath(): string {
  return join(process.cwd(), STARTER_RAG_CONFIG_FILE)
}

function normalizeProvider(value: string | undefined): StarterRagProviderType {
  return value === 'openai' ? 'openai' : 'openrouter'
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function maskKey(value: string | undefined): string | null {
  if (!value) return null
  const last4 = value.slice(-4)
  return `••••${last4}`
}

function previewDatabaseUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.password) url.password = '****'
    if (url.username) url.username = url.username ? '****' : ''
    return url.toString()
  } catch {
    return value.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://****:****@')
  }
}

export async function readStarterRagConfigFile(): Promise<StarterRagConfigFile> {
  try {
    const raw = await readFile(starterRagConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return starterRagConfigSchema.parse(parsed)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {}
    }
    if (error instanceof SyntaxError) {
      return {}
    }
    throw error
  }
}

export async function writeStarterRagConfigFile(
  input: StarterRagSettingsInput,
): Promise<StarterRagSettingsStatus> {
  const current = await readStarterRagConfigFile()
  const provider = input.provider ?? normalizeProvider(current.AI_PROVIDER)
  const next: StarterRagConfigFile = {
    ...current,
    AI_PROVIDER: provider,
    DATABASE_URL: cleanOptional(input.databaseUrl) ?? current.DATABASE_URL,
    CHAT_MODEL: cleanOptional(input.chatModel) ?? current.CHAT_MODEL,
    EMBEDDING_MODEL: cleanOptional(input.embeddingModel) ?? current.EMBEDDING_MODEL,
  }

  const apiKey = cleanOptional(input.apiKey)
  if (apiKey) {
    if (provider === 'openai') {
      next.OPENAI_API_KEY = apiKey
    } else {
      next.OPENROUTER_API_KEY = apiKey
    }
  }

  await writeFile(starterRagConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  try {
    await chmod(starterRagConfigPath(), 0o600)
  } catch {
    // Windows may ignore POSIX chmod. The file is still git-ignored.
  }

  return getStarterRagSettingsStatus()
}

export async function getStarterRagEffectiveSettings(): Promise<StarterRagEffectiveSettings> {
  const file = await readStarterRagConfigFile()
  const provider = normalizeProvider(file.AI_PROVIDER ?? process.env.AI_PROVIDER)
  const apiKey =
    provider === 'openai'
      ? cleanOptional(file.OPENAI_API_KEY) ?? cleanOptional(process.env.OPENAI_API_KEY) ?? ''
      : cleanOptional(file.OPENROUTER_API_KEY) ?? cleanOptional(process.env.OPENROUTER_API_KEY) ?? ''

  return {
    provider,
    apiKey,
    databaseUrl:
      cleanOptional(file.DATABASE_URL) ??
      cleanOptional(process.env.STARTER_RAG_DATABASE_URL) ??
      STARTER_RAG_DEFAULT_DATABASE_URL,
    chatModel:
      cleanOptional(file.CHAT_MODEL) ??
      cleanOptional(process.env.CHAT_MODEL) ??
      STARTER_RAG_DEFAULT_CHAT_MODEL,
    embeddingModel:
      cleanOptional(file.EMBEDDING_MODEL) ??
      cleanOptional(process.env.EMBEDDING_MODEL) ??
      STARTER_RAG_DEFAULT_EMBEDDING_MODEL,
  }
}

export async function getStarterRagSettingsStatus(): Promise<StarterRagSettingsStatus> {
  const settings = await getStarterRagEffectiveSettings()
  return {
    provider: settings.provider,
    apiKeyConfigured: settings.apiKey.length > 0,
    maskedKey: maskKey(settings.apiKey),
    databaseUrlConfigured: settings.databaseUrl.length > 0,
    databaseUrlPreview: previewDatabaseUrl(settings.databaseUrl),
    chatModel: settings.chatModel,
    embeddingModel: settings.embeddingModel,
  }
}

export function getStarterRagSetupHelp(): string[] {
  return [
    'Open Docker Desktop.',
    'Run: cd "G:\\ai-sdk-rag-starter-main\\ai-sdk-rag-starter-main"',
    'Run: docker compose up -d',
    `Use database URL: ${STARTER_RAG_DEFAULT_DATABASE_URL}`,
  ]
}
