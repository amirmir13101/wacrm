import type { RagChunk } from './types'

export const RAG_KNOWLEDGE_CHARACTER_LIMIT = 500_000
export const RAG_CHUNK_OVERLAP_CHARS = 150
export const RAG_MAX_SAFE_CHUNKS_PER_SOURCE = 1_200

export const DEFAULT_RAG_CHUNK_OPTIONS = {
  maxChunkLength: 1000,
  overlapChars: RAG_CHUNK_OVERLAP_CHARS,
} as const

export interface RagChunkOptions {
  readonly maxChunkLength?: number
  readonly maxChunksPerSource?: number
  readonly overlapChars?: number
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

function normalizeOverlap(maxChunkLength: number, overlapChars: number): number {
  if (overlapChars <= 0) return 0
  return Math.min(overlapChars, Math.max(0, Math.floor(maxChunkLength / 2)))
}

export function maxRagChunksForContent(
  contentLength: number,
  options: RagChunkOptions = {},
): number {
  const maxChunkLength = options.maxChunkLength ?? DEFAULT_RAG_CHUNK_OPTIONS.maxChunkLength
  const estimatedMinimumChunkSize = Math.max(1, Math.floor(maxChunkLength / 2))
  const estimatedChunks = Math.ceil(Math.max(contentLength, 1) / estimatedMinimumChunkSize)
  return Math.min(
    RAG_MAX_SAFE_CHUNKS_PER_SOURCE,
    Math.max(25, estimatedChunks + 25),
  )
}

function trailingOverlap(value: string, overlapChars: number): string {
  if (overlapChars <= 0) return ''

  const tail = value.slice(-overlapChars).trim()
  if (!tail) return ''

  const sentenceStart = Math.max(
    tail.lastIndexOf('. '),
    tail.lastIndexOf('! '),
    tail.lastIndexOf('? '),
    tail.lastIndexOf('\n'),
  )
  if (sentenceStart > 0 && tail.length - sentenceStart <= overlapChars) {
    return tail.slice(sentenceStart).replace(/^[.!?\s]+/, '').trim()
  }

  return tail
}

function addNeighborOverlap(
  chunks: ReadonlyArray<string>,
  overlapChars: number,
): ReadonlyArray<string> {
  if (overlapChars <= 0 || chunks.length <= 1) return chunks

  return chunks.map((chunk, index) => {
    if (index === 0) return chunk
    const overlap = trailingOverlap(chunks[index - 1] ?? '', overlapChars)
    if (!overlap || chunk.startsWith(overlap)) return chunk
    return `${overlap}\n${chunk}`.trim()
  })
}

export function createRagChunks(
  content: string,
  options: RagChunkOptions = {},
): ReadonlyArray<RagChunk> {
  const maxChunkLength = options.maxChunkLength ?? DEFAULT_RAG_CHUNK_OPTIONS.maxChunkLength
  const overlapChars = normalizeOverlap(
    maxChunkLength,
    options.overlapChars ?? DEFAULT_RAG_CHUNK_OPTIONS.overlapChars,
  )
  const maxChunksPerSource = options.maxChunksPerSource ?? maxRagChunksForContent(
    content.length,
    { maxChunkLength, overlapChars },
  )

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

  if (packedChunks.length > maxChunksPerSource) {
    throw new Error(
      `Knowledge content needs ${packedChunks.length.toLocaleString()} chunks, which exceeds the safe limit of ${maxChunksPerSource.toLocaleString()} chunks. Shorten the content or split it into multiple knowledge sources.`,
    )
  }

  const overlappedChunks = addNeighborOverlap(packedChunks, overlapChars)
  const remainingFeatureSlots = Math.max(0, maxChunksPerSource - overlappedChunks.length)

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
  }).slice(0, remainingFeatureSlots)

  const uniqueChunks: string[] = []
  const seen = new Set<string>()
  for (const chunk of [...overlappedChunks, ...featureChunks]) {
    if (seen.has(chunk)) continue
    uniqueChunks.push(chunk)
    seen.add(chunk)
  }

  return uniqueChunks.map((chunk, index) => ({
    content: chunk,
    index,
  }))
}
