import { NextResponse } from 'next/server'

import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'

const DEFAULT_GRAPH_API_VERSION = 'v26.0'
const EMBEDDED_SIGNUP_VERSION = 'v4'

function buildHostedSignupUrl(appId: string, configId: string) {
  if (!appId || !configId) return ''

  const url = new URL('https://business.facebook.com/messaging/whatsapp/onboard/')
  url.searchParams.set('app_id', appId)
  url.searchParams.set('config_id', configId)
  url.searchParams.set(
    'extras',
    JSON.stringify({ version: EMBEDDED_SIGNUP_VERSION, sessionInfoVersion: '3' }),
  )

  const redirectUri = process.env.META_HOSTED_EMBEDDED_SIGNUP_REDIRECT_URI?.trim()
  if (redirectUri) url.searchParams.set('redirect_uri', redirectUri)

  return url.toString()
}

function getEmbeddedSignupConfig() {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || ''
  const configId =
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
    process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ||
    ''
  const graphApiVersion = process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION
  const hasAppSecret = Boolean(process.env.META_APP_SECRET)
  const hostedSignupUrl = buildHostedSignupUrl(appId, configId)
  const hostedSignupEnabled =
    process.env.META_HOSTED_EMBEDDED_SIGNUP_ENABLED === 'true' &&
    Boolean(process.env.META_SYSTEM_USER_ACCESS_TOKEN)

  const missing: string[] = []
  if (!appId) missing.push('META_APP_ID')
  if (!configId) missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID')
  if (!hasAppSecret) missing.push('META_APP_SECRET')

  return {
    appId,
    configId,
    graphApiVersion,
    embeddedSignupVersion: EMBEDDED_SIGNUP_VERSION,
    hostedSignupUrl,
    hostedSignupEnabled,
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
    embeddedSignupVersion: config.embeddedSignupVersion,
    hostedSignupUrl: config.configured ? config.hostedSignupUrl : undefined,
    hostedSignupEnabled: config.hostedSignupEnabled,
    missing: config.missing,
    message: config.configured
      ? 'Meta Embedded Signup is configured.'
      : 'Meta Embedded Signup is not configured for this CRM installation.',
  })
}
