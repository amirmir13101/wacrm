export function getSecretLast4(secret: string | null | undefined): string | null {
  const trimmed = secret?.trim()
  if (!trimmed) return null
  return trimmed.slice(-4)
}

export function maskSecret(secret: string | null | undefined): string | null {
  const last4 = getSecretLast4(secret)
  return last4 ? `****${last4}` : null
}

export function sanitizeProviderError(error: unknown): string {
  if (!(error instanceof Error)) return 'Provider request failed.'

  const message = error.message
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')

  if (/fetch failed|network|econnreset|etimedout|timeout/i.test(message)) {
    return 'Provider request failed. Please check your AI provider settings or try again.'
  }

  return message || 'Provider request failed.'
}

export function assertWorkspaceScoped(workspaceId: string): void {
  if (!workspaceId) throw new Error('workspace_id is required.')
}
