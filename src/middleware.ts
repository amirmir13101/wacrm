import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  approvalRedirectPath,
  authenticatedRedirectPath,
  isAdmin,
  type ApprovalProfile,
} from '@/lib/auth/approval'
import {
  canAccessDashboardPath,
  hasWorkspacePermission,
  type WorkspacePermissions,
} from '@/lib/team/permissions'
import { INVITE_TOKEN_COOKIE } from '@/lib/team/invite-constants'
import {
  evaluateWorkspaceBillingAccess,
  isBillingLockAllowedPath,
  type WorkspaceBillingAccessRow,
} from '@/lib/billing/access'
import {
  productionDomainRedirectUrl,
} from '@/lib/domain-routing'

export async function middleware(request: NextRequest) {
  const domainRedirect = routeProductionDomains(request)
  if (domainRedirect) return domainRedirect

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  let profile: ApprovalProfile | null = null
  let activeWorkspaceId: string | null = null
  let workspaceMember: {
    role: string | null
    permissions?: WorkspacePermissions | null
    can_connect_own_whatsapp?: boolean | null
    workspace?:
      | (WorkspaceBillingAccessRow & { archived_at?: string | null })
      | Array<WorkspaceBillingAccessRow & { archived_at?: string | null }>
      | null
  } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, approval_status, active_workspace_id, account_type, must_change_password')
      .eq('user_id', user.id)
      .maybeSingle()

    profile = data ?? { role: 'user', approval_status: 'pending' }
    activeWorkspaceId = data?.active_workspace_id ?? null

    let memberQuery = supabase
      .from('workspace_members')
      .select('role, permissions, can_connect_own_whatsapp, workspace:workspaces(archived_at, plan_type, subscription_status, billing_period, trial_ends_at, subscription_ends_at)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (activeWorkspaceId) {
      memberQuery = memberQuery.eq('workspace_id', activeWorkspaceId)
    }

    let { data: member } = await memberQuery
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (member && workspaceIsArchived(member.workspace)) {
      member = null
    }

    if (!member && activeWorkspaceId) {
      const fallback = await supabase
        .from('workspace_members')
        .select('role, permissions, can_connect_own_whatsapp, workspace:workspaces(archived_at, plan_type, subscription_status, billing_period, trial_ends_at, subscription_ends_at)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })
      member = (fallback.data ?? []).find((row) => !workspaceIsArchived(row.workspace)) ?? null
    }
    workspaceMember = member
  }

  // Auth pages - redirect to dashboard if already logged in
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const inviteToken =
      request.nextUrl.searchParams.get('invite_token') ??
      request.cookies.get(INVITE_TOKEN_COOKIE)?.value ??
      ''
    const redirect = request.nextUrl.searchParams.get('redirect')
    const inviteFlow = redirect === '/invite/accept' || request.nextUrl.searchParams.get('invite') === '1'
    if (inviteToken && inviteFlow) {
      const url = request.nextUrl.clone()
      url.pathname = '/invite/accept'
      url.search = ''
      if (request.nextUrl.searchParams.get('invite_token')) {
        url.searchParams.set('token', inviteToken)
      }
      return NextResponse.redirect(url)
    }
    if (inviteFlow && request.cookies.get(INVITE_TOKEN_COOKIE)?.value) {
      const url = request.nextUrl.clone()
      url.pathname = '/invite/accept'
      url.search = ''
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = authenticatedRedirectPath(profile)
    return NextResponse.redirect(url)
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/flows', '/ai-chatbot', '/billing', '/whatsapp-api-pricing', '/settings', '/team', '/admin', '/admintops', '/article-preview']
  if (
    !user &&
    (
      protectedPaths.some(path => request.nextUrl.pathname.startsWith(path)) ||
      request.nextUrl.pathname === '/change-password'
    )
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user && request.nextUrl.pathname === '/pending-approval') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/pending-approval' && !approvalRedirectPath(profile)) {
    const url = request.nextUrl.clone()
    url.pathname = authenticatedRedirectPath(profile)
    return NextResponse.redirect(url)
  }

  if (
    user &&
    profile?.must_change_password &&
    request.nextUrl.pathname !== '/change-password' &&
    protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/change-password'
    return NextResponse.redirect(url)
  }

  if (user && !profile?.must_change_password && request.nextUrl.pathname === '/change-password') {
    const url = request.nextUrl.clone()
    url.pathname = authenticatedRedirectPath(profile)
    return NextResponse.redirect(url)
  }

  if (user && protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    const isAdminPagePath =
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/admintops') ||
      request.nextUrl.pathname.startsWith('/article-preview')
    const redirectPath = approvalRedirectPath(profile)
    if (redirectPath && request.nextUrl.pathname !== redirectPath) {
      const url = request.nextUrl.clone()
      url.pathname = redirectPath
      return NextResponse.redirect(url)
    }

    if (isAdminPagePath && !isAdmin(profile)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (isAdmin(profile) && !isAdminPagePath) {
      const url = request.nextUrl.clone()
      url.pathname = '/admintops'
      return NextResponse.redirect(url)
    }

    if (
      !isAdminPagePath &&
      workspaceMember &&
      !isBillingLockAllowedPath(request.nextUrl.pathname) &&
      !evaluateWorkspaceBillingAccess(readBillingWorkspace(workspaceMember.workspace)).canUseHostedCrm
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.searchParams.set('upgrade', 'required')
      return NextResponse.redirect(url)
    }

    if (
      !isAdminPagePath &&
      workspaceMember &&
      !canAccessDashboardPath(workspaceMember, request.nextUrl.pathname)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // API routes that need auth (except webhooks and cron-protected worker routes)
  const isCronProtectedBroadcastWorker =
    request.nextUrl.pathname === '/api/whatsapp/broadcast/worker' &&
    Boolean(process.env.AUTOMATION_CRON_SECRET) &&
    request.headers.get('x-cron-secret') === process.env.AUTOMATION_CRON_SECRET

  const isCronProtectedAutomation =
    request.nextUrl.pathname === '/api/automations/cron' &&
    Boolean(process.env.AUTOMATION_CRON_SECRET) &&
    request.headers.get('x-cron-secret') === process.env.AUTOMATION_CRON_SECRET

  const isCronProtectedFlows =
    request.nextUrl.pathname === '/api/flows/cron' &&
    Boolean(process.env.AUTOMATION_CRON_SECRET) &&
    request.headers.get('x-cron-secret') === process.env.AUTOMATION_CRON_SECRET

  if (!user && request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook') &&
      !isCronProtectedBroadcastWorker) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const approvalProtectedApi =
    (request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook') &&
      !isCronProtectedBroadcastWorker) ||
    (request.nextUrl.pathname.startsWith('/api/automations') &&
      !isCronProtectedAutomation) ||
    request.nextUrl.pathname.startsWith('/api/team') ||
    request.nextUrl.pathname.startsWith('/api/contacts') ||
    request.nextUrl.pathname.startsWith('/api/pricing') ||
    request.nextUrl.pathname.startsWith('/api/rag') ||
    (request.nextUrl.pathname.startsWith('/api/flows') && !isCronProtectedFlows) ||
    request.nextUrl.pathname.startsWith('/api/admin') ||
    request.nextUrl.pathname.startsWith('/api/auth/change-password')

  if (!user && approvalProtectedApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user && approvalProtectedApi && approvalRedirectPath(profile)) {
    return NextResponse.json(
      { error: 'Account approval required' },
      { status: 403 }
    )
  }

  if (
    user &&
    approvalProtectedApi &&
    profile?.must_change_password &&
    request.nextUrl.pathname !== '/api/auth/change-password'
  ) {
    return NextResponse.json(
      { error: 'Password change required' },
      { status: 403 }
    )
  }

  if (user && request.nextUrl.pathname.startsWith('/api/admin') && !isAdmin(profile)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  if (
    user &&
    workspaceMember &&
    approvalProtectedApi &&
    !request.nextUrl.pathname.startsWith('/api/admin') &&
    !isBillingLockAllowedPath(request.nextUrl.pathname)
  ) {
    const access = evaluateWorkspaceBillingAccess(readBillingWorkspace(workspaceMember.workspace))
    if (!access.canUseHostedCrm) {
      return NextResponse.json(
        { error: access.message ?? 'Upgrade required to continue using CRM features.', reason: access.reason },
        { status: 402 },
      )
    }
  }

  if (user && workspaceMember) {
    const path = request.nextUrl.pathname
    const method = request.method
    const deny = (message = 'Permission required') =>
      NextResponse.json({ error: message }, { status: 403 })

    if (path.startsWith('/api/whatsapp/config')) {
      if (
        method !== 'GET' &&
        !hasWorkspacePermission(workspaceMember, 'manage_whatsapp_config') &&
        !hasWorkspacePermission(workspaceMember, 'connect_own_whatsapp_config')
      ) return deny('You cannot manage WhatsApp configuration')
    }
    if (path.startsWith('/api/whatsapp/send') && !hasWorkspacePermission(workspaceMember, 'reply_to_conversations')) {
      return deny('You cannot reply to conversations')
    }
    if (path.startsWith('/api/whatsapp/broadcast') && method !== 'GET') {
      const permission = path.endsWith('/control')
        ? 'pause_resume_cancel_broadcasts'
        : 'queue_broadcasts'
      if (!hasWorkspacePermission(workspaceMember, permission)) {
        return deny('You cannot manage broadcasts')
      }
    }
    if (path.startsWith('/api/team') && method !== 'GET' && !hasWorkspacePermission(workspaceMember, 'manage_team_members')) {
      return deny('You cannot manage team members')
    }
    if (path.startsWith('/api/contacts') && method !== 'GET' && !hasWorkspacePermission(workspaceMember, 'edit_contacts')) {
      return deny('You cannot edit contacts')
    }
    if (path.startsWith('/api/pricing') && method !== 'GET' && !hasWorkspacePermission(workspaceMember, 'manage_pricing_rates')) {
      return deny('You cannot manage pricing rates')
    }
    if (path.startsWith('/api/automations') && !path.endsWith('/cron')) {
      if (method === 'GET' && !hasWorkspacePermission(workspaceMember, 'view_automations')) return deny()
      if (method === 'POST' && !hasWorkspacePermission(workspaceMember, 'create_automations')) return deny()
      if ((method === 'PATCH' || method === 'DELETE') && !hasWorkspacePermission(workspaceMember, 'edit_automations')) return deny()
    }
  }

  return supabaseResponse
}

function routeProductionDomains(request: NextRequest): NextResponse | null {
  const hostname =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname
  const redirectUrl = productionDomainRedirectUrl(
    request.nextUrl.pathname,
    hostname,
    request.nextUrl.search,
  )

  return redirectUrl ? NextResponse.redirect(redirectUrl) : null
}

function workspaceIsArchived(
  workspace?: { archived_at?: string | null } | Array<{ archived_at?: string | null }> | null,
): boolean {
  if (Array.isArray(workspace)) return Boolean(workspace[0]?.archived_at)
  return Boolean(workspace?.archived_at)
}

function readBillingWorkspace(
  workspace?:
    | (WorkspaceBillingAccessRow & { archived_at?: string | null })
    | Array<WorkspaceBillingAccessRow & { archived_at?: string | null }>
    | null,
): WorkspaceBillingAccessRow | null {
  if (Array.isArray(workspace)) return workspace[0] ?? null
  return workspace ?? null
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
