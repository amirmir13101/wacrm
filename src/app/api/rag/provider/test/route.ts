import { NextResponse } from 'next/server'

import { testRagProviderSettings } from '@/lib/rag/settings'
import { requireRagPermission, safeErrorMessage } from '../../_helpers'

export async function POST() {
  const auth = await requireRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  try {
    const provider = await testRagProviderSettings(auth.workspace.workspaceId)
    return NextResponse.json({
      provider,
      testMode: 'placeholder',
      message: 'Provider settings were validated locally with backend defaults.',
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
