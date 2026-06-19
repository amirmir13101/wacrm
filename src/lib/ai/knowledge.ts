import { chunkKnowledgeText, type AiKnowledgeSourceType } from '@/lib/ai/chatbot'
import { buildChunkSearchMetadata } from '@/lib/ai/retrieval'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export async function saveKnowledgeSourceWithChunks(args: {
  readonly workspaceId: string
  readonly sourceType: AiKnowledgeSourceType
  readonly title: string
  readonly content: string
}) {
  const admin = supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .insert({
      workspace_id: args.workspaceId,
      source_type: args.sourceType,
      title: args.title,
      content: args.content,
      status: 'active',
    })
    .select('*')
    .single()

  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? 'Failed to save knowledge.')
  }

  const chunks = chunkKnowledgeText(args.content)
  if (chunks.length > 0) {
    const { error: chunksError } = await admin.from('ai_knowledge_chunks').insert(
      chunks.map((chunk, index) => ({
        ...chunkSearchRow(chunk, index, args.title),
        workspace_id: args.workspaceId,
        source_id: source.id,
        chunk_text: chunk,
      })),
    )
    if (chunksError) throw new Error(chunksError.message)
  }

  return source
}

function chunkSearchRow(chunk: string, index: number, title: string) {
  const metadata = buildChunkSearchMetadata(chunk, index)
  return {
    search_text: chunk,
    content_hash: metadata.content_hash,
    token_count: metadata.token_count,
    source_url: metadata.source_url,
    heading_path: title,
    chunk_index: index,
    structured_facts: metadata.structured_facts,
    embedding_status: 'pending',
    metadata: { title, index, ...metadata },
  }
}
