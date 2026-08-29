"use client";

import { useCallback, useEffect, useState } from "react";
import { Hand, Loader2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface AiAccountStatus {
  autoReplyOn: boolean;
}

const statusCache = new Map<string, AiAccountStatus>();

async function fetchAiAccountStatus(accountId: string): Promise<AiAccountStatus> {
  const cached = statusCache.get(accountId);
  if (cached) return cached;

  try {
    const response = await fetch("/api/ai/config", { cache: "no-store" });
    if (!response.ok) return { autoReplyOn: false };

    const data = await response.json();
    const status = {
      autoReplyOn: Boolean(
        data?.configured && data?.is_active && data?.auto_reply_enabled,
      ),
    };
    statusCache.set(accountId, status);
    return status;
  } catch {
    return { autoReplyOn: false };
  }
}

interface AiThreadBannerProps {
  conversationId: string;
  disabled: boolean;
  handoffSummary?: string | null;
  assignedAgentId?: string | null;
  currentUserId?: string | null;
  onChange?: (patch: {
    ai_autoreply_disabled: boolean;
    assigned_agent_id?: string | null;
  }) => void;
}

/** Controls the separate AI Agent auto-reply state for one Inbox thread. */
export function AiThreadBanner({
  conversationId,
  disabled,
  handoffSummary,
  assignedAgentId,
  currentUserId,
  onChange,
}: AiThreadBannerProps) {
  const { accountId } = useAuth();
  const [autoReplyOn, setAutoReplyOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(disabled);

  useEffect(() => setPaused(disabled), [conversationId, disabled]);

  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    fetchAiAccountStatus(accountId).then((status) => {
      if (alive) setAutoReplyOn(status.autoReplyOn);
    });
    return () => {
      alive = false;
    };
  }, [accountId]);

  const toggle = useCallback(
    async (nextPaused: boolean) => {
      setBusy(true);
      try {
        const response = await fetch(`/api/ai/autoreply/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: nextPaused, assign_to_me: nextPaused }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast.error(data?.error ?? "Couldn't update AI Agent status.");
          return;
        }

        setPaused(nextPaused);
        onChange?.({
          ai_autoreply_disabled: nextPaused,
          ...(nextPaused
            ? currentUserId
              ? { assigned_agent_id: currentUserId }
              : {}
            : { assigned_agent_id: null }),
        });
        toast.success(nextPaused ? "You took over this conversation." : "AI Agent resumed.");
      } catch {
        toast.error("Couldn't reach the AI Agent controls.");
      } finally {
        setBusy(false);
      }
    },
    [conversationId, currentUserId, onChange],
  );

  if (!autoReplyOn) return null;

  if (paused) {
    return (
      <Banner tone="muted">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-100">AI Agent is paused here</p>
          {handoffSummary && (
            <p className="truncate text-slate-400" title={handoffSummary}>
              {handoffSummary}
            </p>
          )}
        </div>
        <BannerButton onClick={() => toggle(false)} busy={busy} icon={Undo2}>
          Resume AI
        </BannerButton>
      </Banner>
    );
  }

  if (assignedAgentId) return null;

  return (
    <Banner tone="primary">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <span className="truncate font-medium text-slate-100">
          AI Agent is replying automatically
        </span>
      </div>
      <BannerButton onClick={() => toggle(true)} busy={busy} icon={Hand}>
        Take over
      </BannerButton>
    </Banner>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-3 py-2 text-xs sm:px-4",
        tone === "primary"
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900/70",
      )}
    >
      {children}
    </div>
  );
}

function BannerButton({
  onClick,
  busy,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof Hand;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-slate-900 px-2.5 py-1 font-medium text-slate-100 transition-colors hover:border-emerald-400/60 hover:bg-slate-800 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {children}
    </button>
  );
}
