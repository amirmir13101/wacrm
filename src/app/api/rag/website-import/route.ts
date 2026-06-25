import { NextResponse } from 'next/server'

import { importRagWebsiteKnowledge } from '@/lib/rag/website-import'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url : ''
    const result = await importRagWebsiteKnowledge({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      url,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
