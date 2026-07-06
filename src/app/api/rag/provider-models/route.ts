import { NextResponse } from 'next/server'

import { AI_PROVIDER_CONFIG } from '@/lib/rag/provider-config'
import { listRagProviderModels, withCustomModelOption } from '@/lib/rag/provider-models'
import { isRagProviderType } from '@/lib/rag/settings'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function GET(request: Request) {
  const auth = await requireRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const provider = url.searchParams.get('provider') ?? ''
    const baseUrl = url.searchParams.get('baseUrl')

    if (!isRagProviderType(provider)) {
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 })
    }

    const result = await listRagProviderModels({
      workspaceId: auth.workspace.workspaceId,
      provider,
      baseUrl,
    })

    return NextResponse.json({
      provider,
      label: AI_PROVIDER_CONFIG[provider].label,
      source: result.source,
      message: result.message,
      models: withCustomModelOption(provider, result.models),
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}

