import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  getStarterRagSettingsStatus,
  writeStarterRagConfigFile,
} from '@/lib/starter-rag/config'

import { requireStarterRagPermission, starterRagErrorResponse } from '../_helpers'

export const runtime = 'nodejs'

const settingsSchema = z.object({
  provider: z.enum(['openai', 'openrouter']).optional(),
  apiKey: z.string().optional(),
  databaseUrl: z.string().optional(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
})

export async function GET() {
  const auth = await requireStarterRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({ settings: await getStarterRagSettingsStatus() })
  } catch (error) {
    return starterRagErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  const auth = await requireStarterRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  try {
    const body = settingsSchema.parse(await request.json())
    return NextResponse.json({ settings: await writeStarterRagConfigFile(body) })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}
