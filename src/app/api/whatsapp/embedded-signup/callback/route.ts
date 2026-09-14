import { NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { encrypt } from '@/lib/whatsapp/encryption'
import { verifyPhoneNumber, type MetaPhoneInfo } from '@/lib/whatsapp/meta-api'

const DEFAULT_GRAPH_API_VERSION = 'v26.0'

interface ExchangeResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; code?: number; type?: string }
}

interface MetaMutationResponse {
  success?: boolean
  error?: { message?: string; code?: number; type?: string }
}

interface MetaDebugTokenResponse {
  data?: {
    app_id?: string
    is_valid?: boolean
    scopes?: string[]
    granular_scopes?: Array<{
      scope?: string
      target_ids?: string[]
    }>
  }
  error?: { message?: string; code?: number; type?: string }
}

interface MetaPhoneNumbersResponse {
  data?: Array<{ id?: string }>
  error?: { message?: string; code?: number; type?: string }
}

interface MetaTokenGrant {
  hasManagementPermission: boolean
  hasMessagingPermission: boolean
  managementTargetIds: string[]
}

function generateRegistrationPin(): string {
  return randomInt(100000, 1000000).toString()
}

function getServerConfig() {
  return {
    appId: process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphApiVersion: process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION,
  }
}

async function exchangeCodeForToken(args: {
  code: string
  appId: string
  appSecret: string
  graphApiVersion: string
}) {
  const params = new URLSearchParams({
    client_id: args.appId,
    client_secret: args.appSecret,
    code: args.code,
  })

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/oauth/access_token?${params.toString()}`,
    { method: 'GET' },
  )
  const payload = (await response.json().catch(() => ({}))) as ExchangeResponse

  if (!response.ok || !payload.access_token) {
    const detail = payload.error?.message || `HTTP ${response.status}`
    throw new Error(`Meta authorization code exchange failed: ${detail}`)
  }

  return payload.access_token
}

async function inspectBusinessTokenGrant(args: {
  accessToken: string
  appId: string
  appSecret: string
  graphApiVersion: string
}): Promise<MetaTokenGrant> {
  const params = new URLSearchParams({ input_token: args.accessToken })
  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/debug_token?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${args.appId}|${args.appSecret}`,
      },
    },
  )
  const payload = (await response.json().catch(() => ({}))) as MetaDebugTokenResponse

  if (!response.ok || !payload.data) {
    const detail = payload.error?.message || `HTTP ${response.status}`
    throw new Error(`Meta token permission check failed: ${detail}`)
  }

  if (payload.data.is_valid !== true || payload.data.app_id !== args.appId) {
    throw new Error('Meta returned an invalid business token for this app. Please reconnect WhatsApp.')
  }

  const scopes = new Set(payload.data.scopes || [])
  const granularScopes = payload.data.granular_scopes || []
  const managementScope = granularScopes.find(
    (item) => item.scope === 'whatsapp_business_management',
  )

  return {
    hasManagementPermission:
      scopes.has('whatsapp_business_management') || Boolean(managementScope),
    hasMessagingPermission:
      scopes.has('whatsapp_business_messaging') ||
      granularScopes.some((item) => item.scope === 'whatsapp_business_messaging'),
    managementTargetIds: Array.from(
      new Set(
        (managementScope?.target_ids || []).filter(
          (targetId): targetId is string => typeof targetId === 'string' && targetId.length > 0,
        ),
      ),
    ),
  }
}

async function wabaContainsPhoneNumber(args: {
  wabaId: string
  phoneNumberId: string
  accessToken: string
  graphApiVersion: string
}): Promise<boolean> {
  const params = new URLSearchParams({ fields: 'id', limit: '100' })
  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/${args.wabaId}/phone_numbers?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
      },
    },
  )
  const payload = (await response.json().catch(() => ({}))) as MetaPhoneNumbersResponse

  if (!response.ok || !Array.isArray(payload.data)) {
    return false
  }

  return payload.data.some((phoneNumber) => phoneNumber.id === args.phoneNumberId)
}

async function resolveAuthorizedWabaId(args: {
  returnedWabaId: string
  phoneNumberId: string
  accessToken: string
  graphApiVersion: string
  tokenGrant: MetaTokenGrant
}): Promise<string> {
  const candidateWabaIds = Array.from(
    new Set([args.returnedWabaId, ...args.tokenGrant.managementTargetIds]),
  )

  for (const candidateWabaId of candidateWabaIds) {
    if (
      await wabaContainsPhoneNumber({
        wabaId: candidateWabaId,
        phoneNumberId: args.phoneNumberId,
        accessToken: args.accessToken,
        graphApiVersion: args.graphApiVersion,
      })
    ) {
      return candidateWabaId
    }
  }

  if (!args.tokenGrant.hasManagementPermission) {
    throw new Error(
      'Meta did not grant WhatsApp Business Management access. Please reconnect and approve all requested WhatsApp permissions.',
    )
  }

  throw new Error(
    'Meta did not grant this app access to the selected WhatsApp Business Account. Please reconnect and select the same business portfolio, WhatsApp account, and phone number.',
  )
}

async function subscribeAppToWaba(args: {
  wabaId: string
  accessToken: string
  graphApiVersion: string
}) {
  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/${args.wabaId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
      },
    },
  )
  const payload = (await response.json().catch(() => ({}))) as MetaMutationResponse

  if (!response.ok || payload.success === false) {
    const detail = payload.error?.message || `HTTP ${response.status}`
    throw new Error(`Meta WABA webhook subscription failed: ${detail}`)
  }
}

async function registerPhoneNumber(args: {
  phoneNumberId: string
  accessToken: string
  graphApiVersion: string
  pin: string
}) {
  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/${args.phoneNumberId}/register`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: args.pin,
      }),
    },
  )
  const payload = (await response.json().catch(() => ({}))) as MetaMutationResponse

  if (!response.ok || payload.success === false) {
    const detail = payload.error?.message || `HTTP ${response.status}`
    throw new Error(`Meta phone registration failed: ${detail}`)
  }
}

export async function POST(request: Request) {
  try {
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

    const serverConfig = getServerConfig()
    if (!serverConfig.appId || !serverConfig.appSecret) {
      return NextResponse.json(
        { error: 'Meta Embedded Signup is not configured for this CRM installation.' },
        { status: 400 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown
      phone_number_id?: unknown
      waba_id?: unknown
    }
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const phoneNumberId =
      typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : ''
    const wabaId = typeof body.waba_id === 'string' ? body.waba_id.trim() : ''

    if (!code || !phoneNumberId || !wabaId) {
      return NextResponse.json(
        { error: 'Meta signup requires a code, phone number ID, and WABA ID.' },
        { status: 400 },
      )
    }

    const registrationPin = generateRegistrationPin()

    const accessToken = await exchangeCodeForToken({
      code,
      appId: serverConfig.appId,
      appSecret: serverConfig.appSecret,
      graphApiVersion: serverConfig.graphApiVersion,
    })

    const tokenGrant = await inspectBusinessTokenGrant({
      accessToken,
      appId: serverConfig.appId,
      appSecret: serverConfig.appSecret,
      graphApiVersion: serverConfig.graphApiVersion,
    })

    if (!tokenGrant.hasMessagingPermission) {
      throw new Error(
        'Meta did not grant WhatsApp Business Messaging access. Please reconnect and approve all requested WhatsApp permissions.',
      )
    }

    const authorizedWabaId = await resolveAuthorizedWabaId({
      returnedWabaId: wabaId,
      phoneNumberId,
      accessToken,
      graphApiVersion: serverConfig.graphApiVersion,
      tokenGrant,
    })

    await subscribeAppToWaba({
      wabaId: authorizedWabaId,
      accessToken,
      graphApiVersion: serverConfig.graphApiVersion,
    })

    await registerPhoneNumber({
      phoneNumberId,
      accessToken,
      graphApiVersion: serverConfig.graphApiVersion,
      pin: registrationPin,
    })

    let phoneInfo: MetaPhoneInfo = {
      id: phoneNumberId,
      display_phone_number: '',
    }
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId,
        accessToken,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Meta phone metadata error'
      console.warn('[whatsapp embedded signup] optional phone metadata unavailable:', message)
    }

    const encryptedAccessToken = encrypt(accessToken)
    const encryptedRegistrationPin = encrypt(registrationPin)
    const admin = supabaseAdmin()

    const { data: existing } = await admin
      .from('whatsapp_config')
      .select('id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('user_id', workspace.userId)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('whatsapp_config')
        .update({
          phone_number_id: phoneNumberId,
          waba_id: authorizedWabaId,
          access_token: encryptedAccessToken,
          two_step_pin_encrypted: encryptedRegistrationPin,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('[whatsapp embedded signup] update failed:', error)
        return NextResponse.json({ error: 'Failed to save WhatsApp configuration' }, { status: 500 })
      }
    } else {
      const { error } = await admin.from('whatsapp_config').insert({
        user_id: workspace.userId,
        workspace_id: workspace.workspaceId,
        phone_number_id: phoneNumberId,
        waba_id: authorizedWabaId,
        access_token: encryptedAccessToken,
        two_step_pin_encrypted: encryptedRegistrationPin,
        verify_token: null,
        status: 'connected',
        connected_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[whatsapp embedded signup] insert failed:', error)
        return NextResponse.json({ error: 'Failed to save WhatsApp configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      phone_info: phoneInfo,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Meta Embedded Signup error'
    console.error('[whatsapp embedded signup] callback failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
