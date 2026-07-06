export const DEFAULT_SITE_URL = 'https://talkwagon.chat'

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return DEFAULT_SITE_URL

  try {
    const parsed = new URL(configured)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function getCanonicalUrl(path = '/'): string {
  const siteUrl = getSiteUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalizedPath === '/' ? `${siteUrl}/` : `${siteUrl}${normalizedPath}`
}
