export interface AutomationTemplateOption {
  id: string
  name: string
  language: string
  body_text?: string | null
  status?: string | null
}

export interface AutomationTagOption {
  id: string
  name: string
}

export interface AutomationPipelineOption {
  id: string
  name: string
}

export interface AutomationStageOption {
  id: string
  pipeline_id: string
  name: string
}

export interface AutomationMemberOption {
  id: string
  user_id: string
  profile_id: string | null
  full_name: string | null
  email: string | null
  role: string
  status: string
}

export function approvedTemplateOptions<T extends AutomationTemplateOption>(
  templates: T[],
): T[] {
  return templates.filter((template) => template.status === 'Approved')
}

export function stagesForPipeline<T extends AutomationStageOption>(
  stages: T[],
  pipelineId: string | null | undefined,
): T[] {
  if (!pipelineId) return []
  return stages.filter((stage) => stage.pipeline_id === pipelineId)
}

export function selectTemplateConfig(
  value: string,
): { template_name: string; language: string } {
  const [template_name, language = 'en_US'] = value.split('|')
  return { template_name, language }
}

export function templateSelectValue(templateName?: unknown, language?: unknown): string {
  const name = typeof templateName === 'string' ? templateName : ''
  const lang = typeof language === 'string' && language ? language : 'en_US'
  return name ? `${name}|${lang}` : ''
}
