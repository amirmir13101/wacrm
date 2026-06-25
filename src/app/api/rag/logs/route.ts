import { NextResponse } from 'next/server'

import {
  listRagChatLogs,
  type RagLogChannelFilter,
  type RagLogStatusFilter,
} from '@/lib/rag/logs'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

const channelFilters = new Set(['all', 'dashboard', 'whatsapp'])
const statusFilters = new Set(['all', 'answered', 'fallback', 'provider_error', 'failed'])

function readChannel(value: string | null): RagLogChannelFilter {
  return channelFilters.has(value ?? '') ? value as RagLogChannelFilter : 'all'
}

function readStatus(value: string | null): RagLogStatusFilter {
  return statusFilters.has(value ?? '') ? value as RagLogStatusFilter : 'all'
}

export async function GET(request: Request) {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? 25)
    const logs = await listRagChatLogs({
      workspaceId: auth.workspace.workspaceId,
      channel: readChannel(searchParams.get('channel')),
      status: readStatus(searchParams.get('status')),
      limit: Number.isFinite(limit) ? limit : 25,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
