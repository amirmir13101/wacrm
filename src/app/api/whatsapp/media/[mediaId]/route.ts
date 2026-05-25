import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { canSeeConversation } from '@/lib/team/assignment'
import { findWorkspaceWhatsAppConfig } from '@/lib/team/workspace-whatsapp-config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }
    const workspace = workspaceResult.workspace
    const mediaPath = `/api/whatsapp/media/${mediaId}`

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, conversation_id, conversation:conversations(id, workspace_id, assigned_agent_id)')
      .eq('media_url', mediaPath)
      .maybeSingle()

    const conversation = Array.isArray(message?.conversation)
      ? message?.conversation[0]
      : message?.conversation

    if (
      messageError ||
      !conversation ||
      conversation.workspace_id !== workspace.workspaceId ||
      !canSeeConversation({
        role: workspace.role,
        permissions: workspace.permissions,
        actorUserId: user.id,
        assignedAgentId: conversation.assigned_agent_id,
      })
    ) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Fetch and decrypt workspace WhatsApp config without exposing it
    // through client-readable Supabase policies.
    const {
      config,
      error: configError,
    } = await findWorkspaceWhatsAppConfig<{
      phone_number_id: string
      access_token: string
    }>({
      workspaceId: workspace.workspaceId,
      columns: 'phone_number_id, access_token, status',
    })

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Get the download URL from Meta
    const mediaInfo = await getMediaUrl({ mediaId, accessToken })

    // Download the binary data
    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType || mediaInfo.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
