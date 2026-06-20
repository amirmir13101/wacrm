export interface DetectedLanguage {
  readonly code: string
  readonly name: string
  readonly confidence: number
  readonly isRTL: boolean
  readonly needsTranslation: boolean
}

const RTL_LANGUAGE_CODES = new Set(['ar', 'ur', 'he', 'fa', 'ps', 'sd', 'ckb', 'ku'])

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  es: 'Spanish',
  fa: 'Persian',
  fr: 'French',
  he: 'Hebrew',
  ps: 'Pashto',
  sd: 'Sindhi',
  ur: 'Urdu',
}

export function detectLanguage(text: string): DetectedLanguage {
  const sample = text.trim().slice(0, 200)
  if (!sample) return buildDetectedLanguage('en', 0)
  if (sample.length < 3) return buildDetectedLanguage('en', 0.1)

  const arabicChars = countMatches(sample, /[\u0600-\u06ff]/g)
  const latinChars = countMatches(sample, /[a-z]/gi)
  const totalLetters = Math.max(1, arabicChars + latinChars + countMatches(sample, /[\u0370-\u03ff\u0400-\u04ff]/g))

  if (arabicChars / totalLetters > 0.35) {
    const code = /[\u0679\u0688\u0691\u06BA\u06BE\u06C1-\u06D3]/.test(sample) ||
      /\b(کیا|ہے|ہیں|مجھے|بات|کرنی|ایجنٹ|سپورٹ|چاہیے|قیمت)\b/u.test(sample)
      ? 'ur'
      : 'ar'
    return buildDetectedLanguage(code, Math.min(0.99, 0.65 + arabicChars / totalLetters / 3))
  }

  const normalized = sample
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(bonjour|merci|prix|je veux|parler|humain|connectez|avec|question)\b/.test(normalized)) {
    return buildDetectedLanguage('fr', 0.82)
  }
  if (/\b(hola|gracias|precio|quiero|hablar|persona|agente|ayuda|humana|conectar)\b/.test(normalized)) {
    return buildDetectedLanguage('es', 0.82)
  }

  const englishSignals = countMatches(normalized, /\b(the|what|price|support|phone|email|hello|please|i|you|your|how|when|where|do|does|is|are)\b/g)
  return buildDetectedLanguage('en', latinChars > 0 || englishSignals > 0 ? 0.75 : 0)
}

export function languageNameForCode(code: string | null | undefined): string {
  const normalized = (code ?? '').trim().toLowerCase()
  return LANGUAGE_NAMES[normalized] ?? (normalized ? normalized.toUpperCase() : 'Unknown')
}

export function isRtlLanguage(code: string | null | undefined): boolean {
  return RTL_LANGUAGE_CODES.has((code ?? '').trim().toLowerCase())
}

function buildDetectedLanguage(code: string, confidence: number): DetectedLanguage {
  const normalized = code.toLowerCase()
  return {
    code: normalized,
    name: languageNameForCode(normalized),
    confidence: Math.max(0, Math.min(1, confidence)),
    isRTL: isRtlLanguage(normalized),
    needsTranslation: normalized !== 'en',
  }
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0
}
