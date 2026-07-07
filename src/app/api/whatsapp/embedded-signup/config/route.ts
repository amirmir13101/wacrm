import { NextResponse } from 'next/server'

import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'

const DEFAULT_GRAPH_API_VERSION = 'v21.0'

function getEmbeddedSignupConfig() {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || ''
  const configId =
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
    process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ||
    ''
  const graphApiVersion = process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION
  const hasAppSecret = Boolean(process.env.META_APP_SECRET)

  const missing: string[] = []
  if (!appId) missing.push('META_APP_ID')
  if (!configId) missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID')
  if (!hasAppSecret) missing.push('META_APP_SECRET')

  return {
    appId,
    configId,
    graphApiVersion,
    configured: missing.length === 0,
    missing,
  }
}

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  const subject = {
    role: workspace.role,
    permissions: workspace.permissions,
    can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
  }

  if (
    !hasWorkspacePermission(subject, 'manage_whatsapp_config') &&
    !hasWorkspacePermission(subject, 'connect_own_whatsapp_config')
  ) {
    return NextResponse.json(
      { error: 'You cannot manage WhatsApp configuration' },
      { status: 403 },
    )
  }

  const config = getEmbeddedSignupConfig()

  return NextResponse.json({
    configured: config.configured,
    appId: config.configured ? config.appId : undefined,
    configId: config.configured ? config.configId : undefined,
    graphApiVersion: config.graphApiVersion,
    missing: config.missing,
    message: config.configured
      ? 'Meta Embedded Signup is configured.'
      : 'Meta Embedded Signup is not configured for this CRM installation.',
  })
}
