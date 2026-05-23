import { describe, expect, it } from 'vitest'
import {
  extractTemplateVariableNumbers,
  missingTemplateVariables,
  normalizeKeywordConfig,
  resolveTemplateParams,
} from './template-variables'

describe('template variable helpers', () => {
  const contact = {
    name: 'Amir Mir',
    phone: '923489122663',
    email: 'amir@example.com',
    company: 'Coaster',
  }

  it('extracts variables in numeric order', () => {
    expect(extractTemplateVariableNumbers('Hi {{2}}, order {{1}}, again {{2}}')).toEqual([
      '1',
      '2',
    ])
  })

  it('0-variable template sends no params', () => {
    expect(resolveTemplateParams({ requiredVariables: [], mappings: {}, contact })).toEqual([])
  })

  it('1-variable template resolves contact.name', () => {
    expect(
      resolveTemplateParams({
        requiredVariables: ['1'],
        mappings: { '1': { type: 'contact_field', value: 'name' } },
        contact,
      }),
    ).toEqual(['Amir Mir'])
  })

  it('2-variable template resolves params in order', () => {
    expect(
      resolveTemplateParams({
        requiredVariables: ['1', '2'],
        mappings: {
          '2': { type: 'static', value: 'VPS' },
          '1': { type: 'contact_field', value: 'phone' },
        },
        contact,
      }),
    ).toEqual(['923489122663', 'VPS'])
  })

  it('reports missing static text mappings', () => {
    expect(
      missingTemplateVariables(['1'], {
        '1': { type: 'static', value: '' },
      }),
    ).toEqual(['1'])
  })

  it('normalizes comma-separated keyword strings', () => {
    expect(
      normalizeKeywordConfig({
        keywords: 'Price, pricing, cost, , rate, PRICE',
        match_type: 'contains',
      }),
    ).toEqual({
      keywords: ['price', 'pricing', 'cost', 'rate'],
      match_type: 'contains',
    })
  })

  it('normalizes old array keyword configs', () => {
    expect(
      normalizeKeywordConfig({
        keywords: [' Price ', '', 'pricing', 'PRICE', 'Cost'],
        match_type: 'contains',
      }),
    ).toEqual({
      keywords: ['price', 'pricing', 'cost'],
      match_type: 'contains',
    })
  })
})
