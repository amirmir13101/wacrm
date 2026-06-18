import { NextResponse } from 'next/server'

import {
  getPublicFirecrawlSettings,
  saveFirecrawlApiKey,
  testFirecrawlConnection,
} from '@/lib/ai/firecrawl'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  if (!hasWorkspacePermission(workspaceResult.workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }
  try {
    return NextResponse.json({
      settings: await getPublicFirecrawlSettings(workspaceResult.workspace.workspaceId),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Firecrawl settings.' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  if (!hasWorkspacePermission(workspaceResult.workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage Firecrawl settings' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const apiKey = typeof body.api_key === 'string' ? body.api_key : ''
  try {
    return NextResponse.json({
      settings: await saveFirecrawlApiKey(workspaceResult.workspace.workspaceId, apiKey),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Firecrawl API key.' },
      { status: 400 },
    )
  }
}

export async function POST() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  if (!hasWorkspacePermission(workspaceResult.workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot test Firecrawl settings' }, { status: 403 })
  }

  try {
    const result = await testFirecrawlConnection(workspaceResult.workspace.workspaceId)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Firecrawl connection test failed.' },
      { status: 500 },
    )
  }
}
