import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { canSeeConversation } from '@/lib/team/assignment'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTypingIndicator } from '@/lib/whatsapp/meta-api'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }
    const workspace = workspaceResult.workspace
    if (
      !hasWorkspacePermission(
        {
          role: workspace.role,
          permissions: workspace.permissions,
          can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
        },
        'reply_to_conversations',
      )
    ) {
      return NextResponse.json(
        { error: 'You cannot reply to conversations' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const conversationId =
      typeof body.conversation_id === 'string'
        ? body.conversation_id.trim()
        : ''
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 },
      )
    }

    const limit = checkRateLimit(
      `human-typing:${user.id}:${conversationId}`,
      RATE_LIMITS.humanTyping,
    )
    if (!limit.success) return rateLimitResponse(limit)

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, workspace_id, assigned_agent_id, ai_autoreply_disabled')
      .eq('id', conversationId)
      .maybeSingle()

    if (conversationError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (
      conversation.workspace_id &&
      conversation.workspace_id !== workspace.workspaceId
    ) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (
      !canSeeConversation({
        role: workspace.role,
        permissions: workspace.permissions,
        actorUserId: user.id,
        assignedAgentId: conversation.assigned_agent_id,
      })
    ) {
      return NextResponse.json(
        { error: 'You cannot access this conversation' },
        { status: 403 },
      )
    }

    // Human typing is intentionally unavailable while AI owns the thread.
    // The AI pipeline has its own independently gated typing lifecycle.
    if (conversation.ai_autoreply_disabled !== true) {
      return NextResponse.json({ signaled: false, reason: 'ai_active' })
    }

    const { data: inboundMessage, error: messageError } = await supabase
      .from('messages')
      .select('message_id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .not('message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }
    if (!inboundMessage?.message_id) {
      return NextResponse.json({ signaled: false, reason: 'no_inbound_message' })
    }

    const { config, error: configError } =
      await findWorkspaceWhatsAppConfig<{
        phone_number_id: string
        access_token: string
      }>({
        workspaceId: conversation.workspace_id ?? workspace.workspaceId,
        columns: 'phone_number_id, access_token, status',
      })

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this workspace' },
        { status: 400 },
      )
    }

    await sendTypingIndicator({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      messageId: inboundMessage.message_id,
    })

    return NextResponse.json({ signaled: true })
  } catch (error) {
    console.warn(
      '[whatsapp/human-typing] typing signal failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    // Typing is best-effort and must never interrupt message composition.
    return NextResponse.json({ error: 'Typing signal failed' }, { status: 502 })
  }
}
