import type { RagChunk } from './types'

export const DEFAULT_RAG_CHUNK_OPTIONS = {
  maxChunkLength: 1000,
  maxChunksPerSource: 160,
} as const

export interface RagChunkOptions {
  readonly maxChunkLength?: number
  readonly maxChunksPerSource?: number
}

function splitLongText(value: string, maxLength: number): ReadonlyArray<string> {
  if (value.length <= maxLength) return [value]

  const chunks: string[] = []
  for (let start = 0; start < value.length; start += maxLength) {
    const chunk = value.slice(start, start + maxLength).trim()
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

export function createRagChunks(
  content: string,
  options: RagChunkOptions = {},
): ReadonlyArray<RagChunk> {
  const maxChunkLength = options.maxChunkLength ?? DEFAULT_RAG_CHUNK_OPTIONS.maxChunkLength
  const maxChunksPerSource =
    options.maxChunksPerSource ?? DEFAULT_RAG_CHUNK_OPTIONS.maxChunksPerSource

  const sentenceChunks = content
    .split(/\n+|(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => splitLongText(chunk, maxChunkLength))

  const packedChunks: string[] = []
  let current = ''

  for (const sentence of sentenceChunks) {
    const next = current ? `${current} ${sentence}` : sentence
    if (next.length <= maxChunkLength) {
      current = next
      continue
    }
    if (current) packedChunks.push(current)
    current = sentence
  }

  if (current) packedChunks.push(current)

  const featureChunks = packedChunks.flatMap((chunk) => {
    if (!chunk.toLowerCase().includes('supports')) return []

    return chunk
      .replace(/\.$/, '')
      .split(',')
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0 && feature !== chunk)
      .map((feature) =>
        feature.toLowerCase().startsWith('the system supports')
          ? `${feature}.`
          : `The system supports ${feature}.`,
      )
  })

  return Array.from(new Set([...packedChunks, ...featureChunks]))
    .slice(0, maxChunksPerSource)
    .map((chunk, index) => ({
      content: chunk,
      index,
    }))
}
