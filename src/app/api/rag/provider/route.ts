import { NextResponse } from 'next/server'

import {
  getRagProviderSettings,
  isRagProviderType,
  saveRagProviderSettings,
} from '@/lib/rag/settings'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const provider = await getRagProviderSettings(auth.workspace.workspaceId)
    return NextResponse.json({ provider })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''

    if (!isRagProviderType(provider)) {
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 })
    }

    const settings = await saveRagProviderSettings({
      workspaceId: auth.workspace.workspaceId,
      provider,
      apiKey,
    })

    return NextResponse.json({ provider: settings })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
