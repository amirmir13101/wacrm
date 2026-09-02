import { supabaseAdmin } from '@/lib/automations/admin-client'

type AdminClient = ReturnType<typeof supabaseAdmin>

export function renderTemplatePreview(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (placeholder, rawIndex: string) => {
    const index = Number(rawIndex) - 1
    return params[index] ?? placeholder
  })
}

export async function recordSentBroadcastMessage(args: {
  admin: AdminClient
  workspaceId: string
  userId: string
  contactId: string
  whatsappMessageId: string
  templateName: string
  contentText: string
  sentAt: string
}): Promise<void> {
  const { error } = await args.admin.rpc('record_outbound_inbox_message', {
    p_workspace_id: args.workspaceId,
    p_user_id: args.userId,
    p_contact_id: args.contactId,
    p_whatsapp_message_id: args.whatsappMessageId,
    p_template_name: args.templateName,
    p_content_text: args.contentText,
    p_sent_at: args.sentAt,
  })

  if (error) {
    throw new Error(`Failed to add sent broadcast message to Inbox: ${error.message}`)
  }
}
