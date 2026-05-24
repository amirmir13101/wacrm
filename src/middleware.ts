import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  approvalRedirectPath,
  isAdmin,
  type ApprovalProfile,
} from '@/lib/auth/approval'

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
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('user_id', user.id)
      .maybeSingle()

    profile = data ?? { role: 'user', approval_status: 'pending' }
  }

  // Auth pages - redirect to dashboard if already logged in
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    url.pathname = approvalRedirectPath(profile) ?? '/dashboard'
    return NextResponse.redirect(url)
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings', '/admin']
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

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
