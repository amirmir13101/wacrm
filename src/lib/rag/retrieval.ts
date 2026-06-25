import type { RagRetrievedChunk } from './types'

export interface RagRetrievalRequest {
  readonly workspaceId: string
  readonly question: string
  readonly queryEmbedding: ReadonlyArray<number>
  readonly matchCount?: number
}

export interface RagRetrievalPort {
  readonly retrieve: (
    request: RagRetrievalRequest,
  ) => Promise<ReadonlyArray<RagRetrievedChunk>>
}

export const DEFAULT_RAG_MATCH_COUNT = 4

export async function retrieveWorkspaceRagChunks(
  port: RagRetrievalPort,
  request: RagRetrievalRequest,
): Promise<ReadonlyArray<RagRetrievedChunk>> {
  if (!request.workspaceId) throw new Error('workspace_id is required for RAG retrieval.')
  return port.retrieve({
    ...request,
    matchCount: request.matchCount ?? DEFAULT_RAG_MATCH_COUNT,
  })
}
