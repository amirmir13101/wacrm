import { describe, expect, it } from 'vitest'

import { detectLanguage, isRtlLanguage, languageNameForCode } from './language'

describe('AI chatbot language detection', () => {
  it('detects English without requiring translation', () => {
    expect(detectLanguage('What is your support phone number?')).toMatchObject({
      code: 'en',
      needsTranslation: false,
      isRTL: false,
    })
  })

  it('detects Arabic as RTL', () => {
    expect(detectLanguage('ما هو رقم الهاتف للدعم؟')).toMatchObject({
      code: 'ar',
      needsTranslation: true,
      isRTL: true,
    })
  })

  it('detects Urdu as RTL', () => {
    expect(detectLanguage('قیمت کیا ہے اور سپورٹ سے بات کرنی ہے؟')).toMatchObject({
      code: 'ur',
      needsTranslation: true,
      isRTL: true,
    })
  })

  it('detects French as non-RTL', () => {
    expect(detectLanguage('Bonjour, quel est le prix du forfait Pro ?')).toMatchObject({
      code: 'fr',
      needsTranslation: true,
      isRTL: false,
    })
  })

  it('handles very short text gracefully', () => {
    const detected = detectLanguage('ok')
    expect(detected.code).toBe('en')
    expect(detected.confidence).toBeGreaterThanOrEqual(0)
  })

  it('uses only the first 200 characters for detection', () => {
    const detected = detectLanguage(`${'hello '.repeat(60)}ما هو السعر؟`)
    expect(detected.code).toBe('en')
  })

  it('maps RTL codes and names safely', () => {
    expect(isRtlLanguage('ur')).toBe(true)
    expect(languageNameForCode('ar')).toBe('Arabic')
    expect(languageNameForCode('zz')).toBe('ZZ')
  })
})
