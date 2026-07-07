import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

const automationEngine = readFileSync(
  join(process.cwd(), 'src/lib/automations/engine.ts'),
  'utf8',
)

const flowMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/053_flows_and_meta_templates.sql'),
  'utf8',
)

describe('WhatsApp webhook flow integration', () => {
  it('dispatches inbound WhatsApp messages into the flow runner', () => {
    expect(webhookRoute).toContain("import { dispatchInboundToFlows } from '@/lib/flows/engine'")
    expect(webhookRoute).toContain('const flowResult = await dispatchInboundToFlows({')
    expect(webhookRoute).toContain('workspaceId,')
    expect(webhookRoute).toContain('contactId: contactRecord.id')
    expect(webhookRoute).toContain('conversationId: conversation.id')
    expect(webhookRoute).toContain('isFirstInboundMessage')
  })

  it('passes interactive button and list replies to the flow runner', () => {
    expect(webhookRoute).toContain("message.type === 'interactive'")
    expect(webhookRoute).toContain('message.interactive?.button_reply ?? message.interactive?.list_reply')
    expect(webhookRoute).toContain("kind: 'interactive_reply'")
    expect(webhookRoute).toContain('reply_id: interactiveReplyId')
    expect(webhookRoute).toContain('interactive_reply_id: interactiveReplyId')
    expect(webhookRoute).toContain("'interactive',")
  })

  it('orders inbound responders as Flow first, AI second, then automations with reply suppression', () => {
    expect(webhookRoute).toContain('let flowConsumed = false')
    expect(webhookRoute).toContain('flowConsumed = flowResult.consumed')
    expect(webhookRoute).toContain('let aiReplied = false')
    expect(webhookRoute).toContain("if (!flowConsumed && message.type === 'text')")
    expect(webhookRoute).toContain('aiReplied = await maybeHandleRagAutoReply({')
    expect(webhookRoute).toContain("automationTriggers.push('new_message_received', 'keyword_match')")
    expect(webhookRoute).toContain('suppressCustomerReplies: flowConsumed || aiReplied')
    expect(webhookRoute.indexOf('const flowResult = await dispatchInboundToFlows({')).toBeLessThan(
      webhookRoute.indexOf('aiReplied = await maybeHandleRagAutoReply({'),
    )
    expect(webhookRoute.indexOf('aiReplied = await maybeHandleRagAutoReply({')).toBeLessThan(
      webhookRoute.indexOf('runAutomationsForTrigger({'),
    )
  })

  it('lets automations run side effects while suppressing duplicate customer-facing reply steps', () => {
    expect(automationEngine).toContain('suppressCustomerReplies?: boolean')
    expect(automationEngine).toContain('suppressCustomerReplies: input.suppressCustomerReplies ?? false')
    expect(automationEngine).toContain('if (args.suppressCustomerReplies) {')
    expect(automationEngine).toContain('customer reply suppressed by inbound orchestrator')
    expect(automationEngine).toContain('template reply suppressed by inbound orchestrator')
  })

  it('returns whether RAG auto-reply actually sent a customer-facing message', () => {
    expect(webhookRoute).toContain('}): Promise<boolean> {')
    expect(webhookRoute).toContain('if (!args.workspaceId) return false')
    expect(webhookRoute).toContain('if (!answerText || !args.phoneNumberId) return false')
    expect(webhookRoute).toContain('return true')
  })

  it('scopes inbound contact and conversation lookup to the WhatsApp workspace when available', () => {
    expect(webhookRoute).toContain("if (workspaceId) contactsQuery = contactsQuery.eq('workspace_id', workspaceId)")
    expect(webhookRoute).toContain("if (workspaceId) conversationQuery = conversationQuery.eq('workspace_id', workspaceId)")
  })
})

describe('local flow migration parity', () => {
  it('includes upstream 016 flow media behavior inside the CRM flow migration', () => {
    expect(flowMigration).toContain("'send_media'")
    expect(flowMigration).toContain("'flow-media'")
    expect(flowMigration).toContain('CREATE POLICY "Workspace members can upload flow media"')
    expect(flowMigration).toContain('workspace_id_from_storage_path')
  })
})
