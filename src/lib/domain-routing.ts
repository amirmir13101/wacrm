export const ROOT_DOMAIN = 'talkwagon.chat'
export const WWW_ROOT_DOMAIN = `www.${ROOT_DOMAIN}`
export const APP_DOMAIN = 'app.talkwagon.chat'

export const APP_DOMAIN_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/change-password',
  '/pending-approval',
  '/invite',
  '/dashboard',
  '/inbox',
  '/contacts',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/flows',
  '/ai-chatbot',
  '/billing',
  '/whatsapp-api-pricing',
  '/settings',
  '/team',
  '/admin',
  '/admintops',
] as const

export const PUBLIC_ROOT_DOMAIN_PATHS = [
  '/about',
  '/contact',
  '/checkout',
  '/features',
  '/pricing',
  '/privacy-policy',
  '/refund-policy',
  '/robots.txt',
  '/security',
  '/sitemap.xml',
  '/terms-and-conditions',
] as const

export function isAppDomain(hostname: string): boolean {
  return hostname.toLowerCase() === APP_DOMAIN
}

export function isRootDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === ROOT_DOMAIN || normalized === WWW_ROOT_DOMAIN
}

export function matchesDomainPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function marketingHrefForHost(href: string, hostname: string): string {
  if (!href.startsWith('/')) return href
  return isAppDomain(hostname) ? `https://${ROOT_DOMAIN}${href}` : href
}

export function appHrefForHost(href: string, hostname: string): string {
  if (!href.startsWith('/')) return href
  return isRootDomain(hostname) ? `https://${APP_DOMAIN}${href}` : href
}
