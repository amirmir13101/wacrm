import { estimateTokenCount } from '@/lib/ai/embeddings'

export interface SemanticChunkOptions {
  readonly softLimit?: number
  readonly hardLimit?: number
  readonly minChunkSize?: number
  readonly overlapSentences?: number
}

export interface SemanticChunk {
  readonly text: string
  readonly headingPath: readonly string[]
  readonly estimatedTokens: number
  readonly chunkIndex: number
}

interface SemanticBlock {
  readonly text: string
  readonly headingPath: readonly string[]
  readonly protected: boolean
}

const DEFAULT_SOFT_LIMIT = 800
const DEFAULT_HARD_LIMIT = 1_200
const DEFAULT_MIN_CHUNK_SIZE = 50
const DEFAULT_OVERLAP_SENTENCES = 1
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/

export function chunkTextByCharacter(content: string, size = 1_200, overlap = 200): string[] {
  const normalized = normalizeText(content)
  if (!normalized) return []
  const chunks: string[] = []
  const step = Math.max(1, size - Math.max(0, overlap))
  for (let index = 0; index < normalized.length; index += step) {
    chunks.push(normalized.slice(index, index + size).trim())
  }
  return chunks.filter(Boolean)
}

export function semanticChunkText(
  text: string,
  options: SemanticChunkOptions = {},
): SemanticChunk[] {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const softLimit = positiveInteger(options.softLimit, DEFAULT_SOFT_LIMIT)
  const hardLimit = Math.max(softLimit, positiveInteger(options.hardLimit, DEFAULT_HARD_LIMIT))
  const minChunkSize = Math.min(softLimit, positiveInteger(options.minChunkSize, DEFAULT_MIN_CHUNK_SIZE))
  const overlapSentences = Math.max(0, Math.min(2, Math.floor(options.overlapSentences ?? DEFAULT_OVERLAP_SENTENCES)))
  const blocks = buildSemanticBlocks(normalized, hardLimit)
  const drafts: Array<{ text: string; headingPath: readonly string[] }> = []
  let current: SemanticBlock[] = []

  const flush = (): void => {
    if (current.length === 0) return
    drafts.push({
      text: current.map((block) => block.text).join('\n\n').trim(),
      headingPath: current.at(-1)?.headingPath ?? [],
    })
    current = []
  }

  for (const block of blocks) {
    const candidateText = [...current, block].map((item) => item.text).join('\n\n')
    const candidateTokens = estimateTokenCount(candidateText)
    if (current.length > 0 && candidateTokens > softLimit) {
      flush()
      const previous = drafts.at(-1)
      const prefix = previous && overlapSentences > 0
        ? lastSentences(previous.text, overlapSentences)
        : ''
      current = prefix && estimateTokenCount(`${prefix}\n\n${block.text}`) <= hardLimit
        ? [{ text: prefix, headingPath: block.headingPath, protected: false }, block]
        : [block]
      continue
    }
    current.push(block)
  }
  flush()

  const merged = mergeSmallChunks(drafts, minChunkSize, hardLimit)
  return merged.map((chunk, chunkIndex) => ({
    text: chunk.text,
    headingPath: chunk.headingPath,
    estimatedTokens: estimateTokenCount(chunk.text),
    chunkIndex,
  }))
}

function buildSemanticBlocks(text: string, hardLimit: number): SemanticBlock[] {
  const paragraphs = text.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean)
  const headings: string[] = []
  const blocks: SemanticBlock[] = []

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index] ?? ''
    const headingMatch = paragraph.match(HEADING_PATTERN)
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 1
      headings.splice(level - 1)
      headings[level - 1] = headingMatch[2]?.trim() ?? paragraph
      continue
    }

    const next = paragraphs[index + 1] ?? ''
    const faqPair = looksLikeFaqQuestion(paragraph) && next && !next.match(HEADING_PATTERN)
    const combinedText = faqPair ? `${paragraph}\n\n${next}` : paragraph
    if (faqPair) index += 1
    const protectedBlock = faqPair || looksLikePricingBlock(combinedText)
    blocks.push(...splitOversizedBlock(combinedText, headings, protectedBlock, hardLimit))
  }

  return blocks
}

function splitOversizedBlock(
  text: string,
  headingPath: readonly string[],
  protectedBlock: boolean,
  hardLimit: number,
): SemanticBlock[] {
  if (estimateTokenCount(text) <= hardLimit) {
    return [{ text, headingPath: [...headingPath], protected: protectedBlock }]
  }

  const sentences = splitSentences(text)
  if (sentences.length <= 1) {
    return chunkTextByCharacter(text, hardLimit * 4, 0).map((piece) => ({
      text: piece,
      headingPath: [...headingPath],
      protected: false,
    }))
  }

  const blocks: SemanticBlock[] = []
  let current = ''
  for (const sentence of sentences) {
    const candidate = [current, sentence].filter(Boolean).join(' ')
    if (current && estimateTokenCount(candidate) > hardLimit) {
      blocks.push({ text: current, headingPath: [...headingPath], protected: false })
      current = sentence
    } else {
      current = candidate
    }
  }
  if (current) blocks.push({ text: current, headingPath: [...headingPath], protected: false })
  return blocks
}

function mergeSmallChunks(
  chunks: ReadonlyArray<{ readonly text: string; readonly headingPath: readonly string[] }>,
  minimum: number,
  hardLimit: number,
): Array<{ text: string; headingPath: readonly string[] }> {
  const merged: Array<{ text: string; headingPath: readonly string[] }> = []
  for (const chunk of chunks) {
    const previous = merged.at(-1)
    if (
      previous &&
      (estimateTokenCount(previous.text) < minimum || estimateTokenCount(chunk.text) < minimum) &&
      estimateTokenCount(`${previous.text}\n\n${chunk.text}`) <= hardLimit
    ) {
      merged[merged.length - 1] = {
        text: `${previous.text}\n\n${chunk.text}`,
        headingPath: chunk.headingPath.length > 0 ? chunk.headingPath : previous.headingPath,
      }
    } else {
      merged.push({ text: chunk.text, headingPath: chunk.headingPath })
    }
  }
  return merged
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function lastSentences(value: string, count: number): string {
  return splitSentences(value).slice(-count).join(' ')
}

function looksLikeFaqQuestion(value: string): boolean {
  return /^(?:q(?:uestion)?\s*[:.-]\s*)?.+\?$/i.test(value.trim())
}

function looksLikePricingBlock(value: string): boolean {
  const hasPrice = /(?:[$€£₹]|usd|pkr|eur|gbp|aed|sar|rs\.?)\s*\d|\bprice\s*:|\b\d+(?:[.,]\d+)?\s*\/\s*(?:mo|month|year)/i.test(value)
  const hasNamedOffering = /\b(plan|package|product|service|course|menu|item|treatment|appointment|tier|option)\b/i.test(value)
  const hasSpecs = /\b(ram|cpu|core|storage|duration|includes?|features?|specs?|serves?|delivery|support)\b/i.test(value)
  return hasPrice && (hasNamedOffering || hasSpecs)
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback
  return Math.floor(value as number)
}
