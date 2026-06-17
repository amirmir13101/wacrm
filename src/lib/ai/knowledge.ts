import { chunkKnowledgeText, type AiKnowledgeSourceType } from '@/lib/ai/chatbot'
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
        workspace_id: args.workspaceId,
        source_id: source.id,
        chunk_text: chunk,
        metadata: { source_type: args.sourceType, title: args.title, index },
      })),
    )
    if (chunksError) throw new Error(chunksError.message)
  }

  return source
}
