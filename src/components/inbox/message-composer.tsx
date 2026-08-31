"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import { toast } from "sonner";

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  canReply?: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
  onTypingActivity?: () => void;
  onTypingIdle?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  canReply = true,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
  onTypingActivity,
  onTypingIdle,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired || !canReply) return;

    setSending(true);
    try {
      onTypingIdle?.();
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, canReply, onSend, onTypingIdle, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
      if (e.target.value.trim()) onTypingActivity?.();
      else onTypingIdle?.();
    },
    [adjustHeight, onTypingActivity, onTypingIdle]
  );

  // Ask the separate AI Agent for a suggested reply. This only fills the
  // composer; the agent can review/edit it and nothing is sent until the
  // normal Send button is pressed.
  const handleDraft = useCallback(async () => {
    if (drafting || !canReply) return;
    setDrafting(true);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "ai_not_configured") {
          toast.error("AI Agent is not set up yet — finish Setup first.");
        } else {
          toast.error(data.error ?? "Couldn't draft a reply.");
        }
        return;
      }

      const draftText = typeof data.draft === "string" ? data.draft.trim() : "";
      if (!draftText) {
        toast.error("The AI Agent didn't return a reply.");
        return;
      }

      setText(draftText);
      requestAnimationFrame(() => {
        adjustHeight();
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      });
    } catch {
      toast.error("Couldn't reach the AI Agent.");
    } finally {
      setDrafting(false);
    }
  }, [adjustHeight, canReply, conversationId, drafting]);

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-3">
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}
      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}
      {!canReply && (
        <div className="mb-2 rounded-lg bg-slate-800 px-3 py-2">
          <p className="text-xs text-slate-400">
            You can view this conversation, but replies are not enabled for your role.
          </p>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-white"
          onClick={onOpenTemplates}
          title="Send template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-emerald-300"
          disabled={!canReply || drafting}
          onClick={handleDraft}
          title={canReply ? "Draft with AI Agent" : undefined}
          aria-label="Draft with AI Agent"
        >
          {drafting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onTypingIdle}
          placeholder={
            !canReply
              ? "Reply permission is not enabled"
              : sessionExpired
              ? "Session expired - use a template"
              : "Type a message... (Shift+Enter for new line)"
          }
          disabled={sessionExpired || !canReply}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500/50",
            (sessionExpired || !canReply) && "cursor-not-allowed opacity-50"
          )}
        />

        <Button
          size="sm"
          className="h-9 w-9 shrink-0 bg-violet-600 p-0 hover:bg-violet-500 disabled:opacity-40"
          disabled={!text.trim() || sessionExpired || !canReply || sending}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint sits outside the flex row so its height doesn't push
          `items-end` buttons below the textarea. Indented to line up
          under the textarea left edge (w-9 button + gap-2 = 44px). */}
      <p className="mt-1 pl-11 text-[10px] text-slate-600">
        Type &apos;/&apos; for quick replies
      </p>
    </div>
  );
}
