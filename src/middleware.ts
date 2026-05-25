import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  approvalRedirectPath,
  isAdmin,
  type ApprovalProfile,
} from '@/lib/auth/approval'
import {
  canAccessDashboardPath,
  hasWorkspacePermission,
  type WorkspacePermissions,
} from '@/lib/team/permissions'

export async function middleware(request: NextRequest) {
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
  } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, approval_status, active_workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

    profile = data ?? { role: 'user', approval_status: 'pending' }
    activeWorkspaceId = data?.active_workspace_id ?? null

    let memberQuery = supabase
      .from('workspace_members')
      .select('role, permissions, can_connect_own_whatsapp')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (activeWorkspaceId) {
      memberQuery = memberQuery.eq('workspace_id', activeWorkspaceId)
    }

    let { data: member } = await memberQuery
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!member && activeWorkspaceId) {
      const fallback = await supabase
        .from('workspace_members')
        .select('role, permissions, can_connect_own_whatsapp')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      member = fallback.data
    }
    workspaceMember = member
  }

  // Auth pages - redirect to dashboard if already logged in
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const inviteToken = request.nextUrl.searchParams.get('invite_token')
    const redirect = request.nextUrl.searchParams.get('redirect')
    if (inviteToken && redirect === '/invite/accept') {
      const url = request.nextUrl.clone()
      url.pathname = '/invite/accept'
      url.search = ''
      url.searchParams.set('token', inviteToken)
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = approvalRedirectPath(profile) ?? '/dashboard'
    return NextResponse.redirect(url)
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings', '/team', '/admin']
  if (!user && protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
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
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    const redirectPath = approvalRedirectPath(profile)
    if (redirectPath && request.nextUrl.pathname !== redirectPath) {
      const url = request.nextUrl.clone()
      url.pathname = redirectPath
      return NextResponse.redirect(url)
    }

    if (request.nextUrl.pathname.startsWith('/admin') && !isAdmin(profile)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (
      !request.nextUrl.pathname.startsWith('/admin') &&
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
    request.nextUrl.pathname.startsWith('/api/admin')

  if (!user && approvalProtectedApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user && approvalProtectedApi && approvalRedirectPath(profile)) {
    return NextResponse.json(
      { error: 'Account approval required' },
      { status: 403 }
    )
  }

  if (user && request.nextUrl.pathname.startsWith('/api/admin') && !isAdmin(profile)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
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
    if (path.startsWith('/api/whatsapp/broadcast') && method !== 'GET' && !hasWorkspacePermission(workspaceMember, 'queue_broadcasts')) {
      return deny('You cannot manage broadcasts')
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
