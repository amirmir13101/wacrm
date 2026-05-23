import { describe, expect, it } from 'vitest'
import {
  approvedTemplateOptions,
  selectTemplateConfig,
  stagesForPipeline,
  templateSelectValue,
} from './builder-options'

describe('automation builder options', () => {
  it('filters template options to approved Meta templates only', () => {
    expect(
      approvedTemplateOptions([
        { id: '1', name: 'draft', language: 'en_US', status: 'Draft' },
        { id: '2', name: 'approved', language: 'en_US', status: 'Approved' },
        { id: '3', name: 'rejected', language: 'en_US', status: 'Rejected' },
      ]).map((template) => template.name),
    ).toEqual(['approved'])
  })

  it('stores template name and language from the dropdown value', () => {
    expect(selectTemplateConfig('lead_followup|en_US')).toEqual({
      template_name: 'lead_followup',
      language: 'en_US',
    })
    expect(templateSelectValue('lead_followup', 'en_US')).toBe('lead_followup|en_US')
  })

  it('filters stages to the selected pipeline so the saved value is a stage id', () => {
    const stages = [
      { id: 'stage-1', pipeline_id: 'pipeline-a', name: 'New' },
      { id: 'stage-2', pipeline_id: 'pipeline-b', name: 'Won' },
    ]

    expect(stagesForPipeline(stages, 'pipeline-a')).toEqual([stages[0]])
  })
})
