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
  '/ai-agent',
  '/agents',
  '/knowledge-base',
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
  '/data-deletion',
  '/features',
  '/pricing',
  '/privacy-policy',
  '/refund-policy',
  '/robots.txt',
  '/security',
  '/sitemap.xml',
  '/terms-and-conditions',
  '/use-cases',
  '/wati-alternative',
  '/whatsapp-api-prices',
] as const

export function normalizeDomainHost(hostname: string | null | undefined): string {
  const firstHost = (hostname ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
  if (!firstHost) return ''

  if (firstHost.startsWith('[')) {
    return firstHost.slice(0, firstHost.indexOf(']') + 1)
  }

  return firstHost.split(':')[0] ?? ''
}

export function isAppDomain(hostname: string): boolean {
  return normalizeDomainHost(hostname) === APP_DOMAIN
}

export function isRootDomain(hostname: string): boolean {
  const normalized = normalizeDomainHost(hostname)
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

export function productionDomainRedirectUrl(
  pathname: string,
  hostname: string,
  search = '',
): string | null {
  const normalizedHost = normalizeDomainHost(hostname)

  if (normalizedHost === ROOT_DOMAIN && matchesDomainPath(pathname, APP_DOMAIN_PATHS)) {
    return `https://${APP_DOMAIN}${pathname}${search}`
  }

  if (normalizedHost === APP_DOMAIN && matchesDomainPath(pathname, PUBLIC_ROOT_DOMAIN_PATHS)) {
    return `https://${ROOT_DOMAIN}${pathname}${search}`
  }

  return null
}
