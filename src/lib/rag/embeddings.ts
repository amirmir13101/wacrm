import { embed } from 'ai'
import type { RagChunk, RagEmbeddedChunk, RagResolvedProviderConfig } from './types'
import { createRagOpenAICompatibleProvider } from './provider'

export async function generateRagEmbedding(
  value: string,
  config: RagResolvedProviderConfig,
): Promise<ReadonlyArray<number>> {
  const provider = createRagOpenAICompatibleProvider(config)
  const { embedding } = await embed({
    model: provider.embedding(config.embeddingModel),
    value: value.replaceAll('\n', ' '),
  })
  return embedding
}

export async function generateRagChunkEmbeddings(
  chunks: ReadonlyArray<RagChunk>,
  config: RagResolvedProviderConfig,
): Promise<ReadonlyArray<RagEmbeddedChunk>> {
  const provider = createRagOpenAICompatibleProvider(config)
  const model = provider.embedding(config.embeddingModel)
  const embedded: RagEmbeddedChunk[] = []

  for (const chunk of chunks) {
    const { embedding } = await embed({
      model,
      value: chunk.content,
    })
    embedded.push({
      ...chunk,
      embedding,
      embeddingModel: config.embeddingModel,
    })
  }

  return embedded
}
