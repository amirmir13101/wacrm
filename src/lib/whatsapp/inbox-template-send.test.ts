import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const messageThread = readFileSync(
  join(process.cwd(), 'src/components/inbox/message-thread.tsx'),
  'utf8',
)
const templatePicker = readFileSync(
  join(process.cwd(), 'src/components/inbox/template-picker.tsx'),
  'utf8',
)
const sendRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/send/route.ts'),
  'utf8',
)

describe('Inbox template sending', () => {
  it('sends the exact saved template language selected in the inbox UI', () => {
    expect(messageThread).toContain('template_language: template.language')
    expect(messageThread).toContain('template_name: template.name')
  })

  it('lists approved templates through workspace/RLS scope instead of current-user ownership', () => {
    expect(templatePicker).toContain('.from("message_templates")')
    expect(templatePicker).toContain('.in("status", ["Approved", "APPROVED"])')
    expect(templatePicker).not.toContain('.eq("user_id", user.id)')
  })

  it('resolves approved workspace templates before sending to Meta', () => {
    expect(sendRoute).toContain(".from('message_templates')")
    expect(sendRoute).toContain(".eq('workspace_id', workspace.workspaceId)")
    expect(sendRoute).toContain(".eq('name', resolvedTemplateName)")
    expect(sendRoute).toContain(".eq('language', resolvedTemplateLanguage)")
    expect(sendRoute).toContain('APPROVED_TEMPLATE_STATUSES')
  })

  it('passes resolved template name and language into the Meta payload', () => {
    expect(sendRoute).toContain('templateName: resolvedTemplateName')
    expect(sendRoute).toContain('language: resolvedTemplateLanguage')
    expect(sendRoute).toContain(
      'Meta API error while sending template "${resolvedTemplateName}" (${resolvedTemplateLanguage})',
    )
  })
})
