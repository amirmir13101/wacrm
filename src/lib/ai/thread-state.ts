interface BuildAiThreadUpdateArgs {
  paused: boolean
  assignToMe: boolean
  userId: string
  resumedAt?: string
}

/**
 * Build the persisted ownership state for the Inbox Take over / Resume AI
 * action. A manual resume starts a fresh AI context window while preserving
 * the full visible message history for agents.
 */
export function buildAiThreadUpdate(
  args: BuildAiThreadUpdateArgs,
): Record<string, unknown> {
  const { paused, assignToMe, userId } = args
  const update: Record<string, unknown> = { ai_autoreply_disabled: paused }

  if (paused) {
    if (assignToMe) update.assigned_agent_id = userId
    return update
  }

  return {
    ...update,
    assigned_agent_id: null,
    ai_reply_count: 0,
    ai_handoff_summary: null,
    ai_resumed_at: args.resumedAt ?? new Date().toISOString(),
  }
}
