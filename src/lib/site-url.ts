const LOCAL_SITE_URL = 'http://localhost:3000'

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return LOCAL_SITE_URL

  try {
    const parsed = new URL(configured)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return LOCAL_SITE_URL
  }
}
