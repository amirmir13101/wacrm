import { createRagChunks } from './chunking'
import type { RagChunk, RagKnowledgeSourceDraft } from './types'

export const RAG_KNOWLEDGE_CHARACTER_LIMIT = 500_000

export interface PrepareRagKnowledgeInput {
  readonly workspaceId: string
  readonly title: string
  readonly content: string
  readonly sourceType?: RagKnowledgeSourceDraft['sourceType']
  readonly sourceUrl?: string | null
}

export interface PreparedRagKnowledge {
  readonly source: RagKnowledgeSourceDraft
  readonly chunks: ReadonlyArray<RagChunk>
}

export function cleanRagKnowledgeContent(content: string): string {
  return content
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function prepareRagKnowledgeSource(
  input: PrepareRagKnowledgeInput,
): PreparedRagKnowledge {
  const cleanedContent = cleanRagKnowledgeContent(input.content)
  if (!input.workspaceId) throw new Error('workspace_id is required for RAG knowledge.')
  if (!input.title.trim()) throw new Error('Knowledge title is required.')
  if (!cleanedContent) throw new Error('Knowledge content is required.')
  if (cleanedContent.length > RAG_KNOWLEDGE_CHARACTER_LIMIT) {
    throw new Error(`Knowledge content must be ${RAG_KNOWLEDGE_CHARACTER_LIMIT.toLocaleString()} characters or less.`)
  }

  return {
    source: {
      workspaceId: input.workspaceId,
      title: input.title.trim(),
      sourceType: input.sourceType ?? 'manual',
      rawContent: input.content,
      cleanedContent,
      sourceUrl: input.sourceUrl,
    },
    chunks: createRagChunks(cleanedContent).map((chunk) => ({
      ...chunk,
      metadata: {
        workspaceId: input.workspaceId,
        title: input.title.trim(),
        sourceType: input.sourceType ?? 'manual',
        sourceUrl: input.sourceUrl ?? null,
      },
    })),
  }
}
