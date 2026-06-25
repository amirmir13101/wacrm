import { NextResponse } from 'next/server'

import { testRagFirecrawlSettings } from '@/lib/rag/settings'
import { requireRagPermission, safeErrorMessage } from '../../_helpers'

export async function POST() {
  const auth = await requireRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  try {
    const firecrawl = await testRagFirecrawlSettings(auth.workspace.workspaceId)
    return NextResponse.json({
      firecrawl,
      testMode: 'placeholder',
      message: 'Firecrawl key was validated locally. Website import is ready.',
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
