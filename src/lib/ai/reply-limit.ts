export const DEFAULT_AUTO_REPLY_LIMIT = 3
export const MAX_AUTO_REPLY_LIMIT = 20
export const UNLIMITED_AUTO_REPLY_LIMIT = 0

// PostgreSQL integer upper bound. The existing atomic database function
// requires a positive cap, so Unlimited maps to the largest value it can
// safely accept while retaining the same race protection and increment.
export const UNLIMITED_AUTO_REPLY_CLAIM_LIMIT = 2_147_483_647

export function normalizeAutoReplyLimit(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_AUTO_REPLY_LIMIT
  if (parsed === UNLIMITED_AUTO_REPLY_LIMIT) return UNLIMITED_AUTO_REPLY_LIMIT

  return Math.min(
    MAX_AUTO_REPLY_LIMIT,
    Math.max(1, Math.floor(parsed)),
  )
}

export function hasReachedAutoReplyLimit(
  replyCount: number,
  configuredLimit: number,
): boolean {
  return (
    configuredLimit !== UNLIMITED_AUTO_REPLY_LIMIT &&
    replyCount >= configuredLimit
  )
}

export function autoReplyClaimLimit(configuredLimit: number): number {
  return configuredLimit === UNLIMITED_AUTO_REPLY_LIMIT
    ? UNLIMITED_AUTO_REPLY_CLAIM_LIMIT
    : configuredLimit
}
