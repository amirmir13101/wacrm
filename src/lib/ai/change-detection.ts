export interface ChangeDetectionResult {
  readonly hasChanges: boolean
  readonly changePercent: number
  readonly addedSections: readonly string[]
  readonly removedSections: readonly string[]
  readonly pricingChanged: boolean
  readonly contactChanged: boolean
  readonly summary: string
}

export function detectChanges(previousContent: string | null, newContent: string): ChangeDetectionResult {
  if (previousContent === null) {
    return {
      hasChanges: true,
      changePercent: 100,
      addedSections: [...splitSections(newContent).keys()].filter((heading) => heading !== 'content'),
      removedSections: [],
      pricingChanged: extractPrices(newContent).size > 0,
      contactChanged: extractContacts(newContent).size > 0,
      summary: 'First import detected; all website knowledge is new.',
    }
  }

  const previousSections = splitSections(previousContent)
  const nextSections = splitSections(newContent)
  const addedSections = [...nextSections.keys()].filter((heading) => !previousSections.has(heading) && heading !== 'content')
  const removedSections = [...previousSections.keys()].filter((heading) => !nextSections.has(heading) && heading !== 'content')
  const similarity = jaccard(normalizeWords(previousContent), normalizeWords(newContent))
  const changePercent = Math.round((1 - similarity) * 100)
  const pricingChanged = !setsEqual(extractPrices(previousContent), extractPrices(newContent))
  const contactChanged = !setsEqual(extractContacts(previousContent), extractContacts(newContent))
  const hasChanges = similarity < 0.95 || addedSections.length > 0 || removedSections.length > 0 || pricingChanged || contactChanged

  return {
    hasChanges,
    changePercent,
    addedSections,
    removedSections,
    pricingChanged,
    contactChanged,
    summary: buildSummary({ hasChanges, changePercent, addedSections, removedSections, pricingChanged, contactChanged }),
  }
}

function splitSections(content: string): Map<string, string> {
  const sections = new Map<string, string>()
  let heading = 'content'
  let lines: string[] = []
  const flush = (): void => {
    const value = lines.join('\n').trim()
    if (value) sections.set(heading, value)
    lines = []
  }
  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/)
    if (match) {
      flush()
      heading = normalizeHeading(match[1] ?? '')
    } else {
      lines.push(line)
    }
  }
  flush()
  return sections
}

function normalizeWords(content: string): Set<string> {
  return new Set(content.toLowerCase().replace(/[^a-z0-9@.$+%]+/g, ' ').split(/\s+/).filter((word) => word.length > 1))
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 && right.size === 0) return 1
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / (left.size + right.size - intersection)
}

function extractPrices(content: string): Set<string> {
  return new Set(
    [...content.matchAll(/(?:[$€£₹]|usd|pkr|eur|gbp|aed|sar|rs\.?)\s*\d+(?:[.,]\d+)?(?:\s*\/?\s*(?:mo|month|year|annual))?/gi)]
      .map((match) => match[0].toLowerCase().replace(/\s+/g, ' ').trim()),
  )
}

function extractContacts(content: string): Set<string> {
  const phones = [...content.matchAll(/\+?\d[\d\s().-]{7,}\d/g)]
    .map((match) => match[0])
    .filter((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) && value.replace(/\D/g, '').length >= 8)
  const values = [
    ...content.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi),
    ...content.matchAll(/\b(?:address|location)\s*:\s*[^\n]{5,120}/gi),
  ]
  return new Set([
    ...values.map((match) => match[0]),
    ...phones,
  ].map((value) => value.toLowerCase().replace(/\s+/g, ' ').trim()))
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildSummary(result: Omit<ChangeDetectionResult, 'summary'>): string {
  if (!result.hasChanges) return 'No significant changes detected.'
  const details: string[] = []
  if (result.pricingChanged) details.push('Pricing updated')
  if (result.contactChanged) details.push('Contact information updated')
  const sections = result.addedSections.length + result.removedSections.length
  if (sections > 0) details.push(`${sections} section${sections === 1 ? '' : 's'} changed`)
  if (details.length === 0) details.push('Website content updated')
  return `${details.join(', ')} (${result.changePercent}% of content).`
}
