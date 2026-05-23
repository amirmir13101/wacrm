import type { Contact } from '@/types'

export type TemplateVariableSource = 'contact_field' | 'static'

export interface TemplateVariableMapping {
  type: TemplateVariableSource
  value: string
}

export type TemplateVariableMappings = Record<string, TemplateVariableMapping | string>

export function extractTemplateVariableNumbers(text: string | null | undefined): string[] {
  const found = new Set<number>()
  const source = text ?? ''
  for (const match of source.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(match[1])
    if (Number.isInteger(n) && n > 0) found.add(n)
  }
  return [...found].sort((a, b) => a - b).map(String)
}

export function normalizeKeywordConfig(config: unknown): {
  keywords: string[]
  match_type: 'exact' | 'contains'
  case_sensitive?: boolean
} {
  const cfg = (config ?? {}) as Record<string, unknown>
  const raw = Array.isArray(cfg.keywords)
    ? cfg.keywords
    : typeof cfg.keywords === 'string'
      ? cfg.keywords.split(',')
      : []
  const keywords = raw
    .map((v) => String(v).trim())
    .filter(Boolean)

  return {
    keywords,
    match_type: cfg.match_type === 'exact' ? 'exact' : 'contains',
    ...(typeof cfg.case_sensitive === 'boolean'
      ? { case_sensitive: cfg.case_sensitive }
      : {}),
  }
}

export function resolveTemplateParams(args: {
  requiredVariables: string[]
  mappings: TemplateVariableMappings | null | undefined
  contact: Pick<Contact, 'name' | 'phone' | 'email' | 'company'>
}): string[] {
  const provided = args.mappings ?? {}
  return args.requiredVariables.map((variable) => {
    const mapping = provided[variable]
    if (typeof mapping === 'string') return mapping
    if (!mapping) return ''

    if (mapping.type === 'static') return mapping.value ?? ''
    if (mapping.type === 'contact_field') {
      const field = mapping.value as 'name' | 'phone' | 'email' | 'company'
      return String(args.contact[field] ?? '')
    }
    return ''
  })
}

export function missingTemplateVariables(
  requiredVariables: string[],
  mappings: TemplateVariableMappings | null | undefined,
): string[] {
  const provided = mappings ?? {}
  return requiredVariables.filter((variable) => {
    const mapping = provided[variable]
    if (typeof mapping === 'string') return mapping.trim() === ''
    if (!mapping) return true
    if (mapping.type === 'static') return !mapping.value?.trim()
    if (mapping.type === 'contact_field') return !mapping.value
    return true
  })
}
