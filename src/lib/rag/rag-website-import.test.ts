import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  __ragWebsiteImportTestUtils,
  validateRagWebsiteUrl,
} from './website-import'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const websiteImportRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/website-import/route.ts'),
  'utf8',
)
const websiteImport = readFileSync(
  join(process.cwd(), 'src/lib/rag/website-import.ts'),
  'utf8',
)
const knowledgeStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/knowledge-store.ts'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG Firecrawl website import', () => {
  it('validates URLs for single page website import', () => {
    expect(validateRagWebsiteUrl('https://example.com')).toBe('https://example.com/')
    expect(validateRagWebsiteUrl('http://example.com/page')).toBe('http://example.com/page')
    expect(() => validateRagWebsiteUrl('not-a-url')).toThrow('Enter a valid website URL.')
    expect(() => validateRagWebsiteUrl('ftp://example.com')).toThrow(
      'Only http and https website URLs are supported.',
    )
  })

  it('extracts markdown/text/title/final URL from Firecrawl responses', () => {
    const extracted = __ragWebsiteImportTestUtils.extractFirecrawlContent({
      success: true,
      data: {
        markdown: '# Hello\n\nSupport email is support@example.com',
        metadata: {
          title: 'Example Support',
          sourceURL: 'https://example.com/support',
        },
      },
    })

    expect(extracted.title).toBe('Example Support')
    expect(extracted.finalUrl).toBe('https://example.com/support')
    expect(extracted.content).toContain('Support email is support@example.com')
  })

  it('adds the website import API route with workspace permission and no key exposure', () => {
    expect(websiteImportRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(websiteImportRoute).toContain('importRagWebsiteKnowledge')
    expect(websiteImportRoute).toContain('embedRagManualKnowledgeSource')
    expect(websiteImportRoute).toContain('shouldAutoEmbedRagKnowledge')
    expect(websiteImportRoute).toContain('createSkippedRagEmbeddingSummary')
    expect(websiteImportRoute).toContain('embeddingSummary')
    expect(websiteImportRoute).toContain('sanitizeProviderError')
    expect(websiteImportRoute).not.toContain('encrypted_api_key')

    expect(websiteImport).toContain("from('rag_firecrawl_settings')")
    expect(websiteImport).toContain('decrypt(row.encrypted_api_key)')
    expect(websiteImport).toContain('Add your Firecrawl API key first.')
    expect(websiteImport).toContain('https://api.firecrawl.dev/v1/scrape')
    expect(websiteImport).toContain("formats: ['markdown']")
  })

  it('enforces readable content and the shared 500,000 character limit', () => {
    expect(websiteImport).toContain('No readable website content was found.')
    expect(websiteImport).toContain('RAG_KNOWLEDGE_CHARACTER_LIMIT')
    expect(websiteImport).toContain('This website content is too large.')
  })

  it('saves website sources and chunks in rag tables only', () => {
    expect(knowledgeStore).toContain('createRagWebsiteKnowledge')
    expect(knowledgeStore).toContain("source_type: 'website'")
    expect(knowledgeStore).toContain("from('rag_knowledge_sources')")
    expect(knowledgeStore).toContain("from('rag_knowledge_chunks')")
    expect(knowledgeStore).not.toContain("from('ai_")
    expect(websiteImport).not.toContain("from('ai_")
  })

  it('adds simple website import UI and keeps WhatsApp auto-reply guarded', () => {
    expect(page).toContain('Website Import')
    expect(page).toContain('https://example.com')
    expect(page).toContain('Import Website')
    expect(page).toContain('Importing website...')
    expect(page).toContain('Reading website content...')
    expect(page).toContain('Add your Firecrawl API key first.')
    expect(page).toContain('/api/rag/website-import')
    expect(page).not.toContain('scrape depth')
    expect(page).not.toContain('crawler settings')
    expect(page).not.toContain('raw Firecrawl')
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
