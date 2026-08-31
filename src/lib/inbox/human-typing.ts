export const HUMAN_TYPING_IDLE_MS = 2_500
export const HUMAN_TYPING_MIN_SIGNAL_INTERVAL_MS = 8_000

export function shouldSendHumanTypingSignal(args: {
  handoffActive: boolean
  lastSignalAt: number
  now: number
}): boolean {
  if (!args.handoffActive) return false
  return (
    args.lastSignalAt === 0 ||
    args.now - args.lastSignalAt >= HUMAN_TYPING_MIN_SIGNAL_INTERVAL_MS
  )
}
