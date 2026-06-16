"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  Message,
  MessageReaction,
  Contact,
  ConversationStatus,
  MessageTemplate,
} from "@/types";
import type { WorkspaceMemberOption } from "@/lib/team/assignment";
import {
  MessageSquare,
  Bot,
  ChevronDown,
  UserPlus,
  Check,
  Clock,
  ArrowLeft,
  PauseCircle,
  PlayCircle,
  Hand,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageBubble } from "./message-bubble";
import { MessageActions } from "./message-actions";
import { MessageComposer } from "./message-composer";
import { TemplatePicker } from "./template-picker";
import { buildReplyPreview } from "./reply-quote";
import { toast } from "sonner";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

interface AssignmentHistoryRow {
  id: string;
  assigned_to_user_id: string | null;
  assigned_by_user_id: string | null;
  reason: string | null;
  created_at: string;
}

type AiConversationStatus = "ai_active" | "ai_paused" | "needs_human";

interface AiConversationControl {
  status: AiConversationStatus;
  last_skipped_reason?: string | null;
  last_skipped_at?: string | null;
  last_ai_reply_at?: string | null;
  handoff_reason?: string | null;
}

interface AiConversationControlResponse {
  control: AiConversationControl;
  lastSkippedMessage?: string | null;
  canManage: boolean;
}

function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const idx = Number(raw) - 1;
    return params[idx] ?? `{{${raw}}}`;
  });
}

interface MessageThreadProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  onMessagesLoaded: (messages: Message[]) => void;
  onNewMessage: (message: Message) => void;
  onUpdateMessage: (id: string, updates: Partial<Message>) => void;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onAssignChange: (
    conversationId: string,
    assignedAgentId: string | null,
  ) => void;
  /**
   * On mobile, the thread is shown full-screen with the conversation list
   * hidden. This callback lets the page deselect the active conversation
   * and reveal the list again. Rendered as a back-arrow in the header on
   * mobile only.
   */
  onBack?: () => void;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const day = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (day !== currentDate) {
      currentDate = day;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

const STATUS_OPTIONS: { label: string; value: ConversationStatus; color: string }[] = [
  { label: "Open", value: "open", color: "text-violet-400" },
  { label: "Pending", value: "pending", color: "text-amber-400" },
  { label: "Closed", value: "closed", color: "text-slate-400" },
];

export function MessageThread({
  conversation,
  contact,
  messages,
  onMessagesLoaded,
  onNewMessage,
  onUpdateMessage,
  onStatusChange,
  onAssignChange,
  onBack,
}: MessageThreadProps) {
  const { user } = useAuth();
  const workspace = useWorkspacePermissions();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyDraft | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryRow[]>([]);
  const [aiControl, setAiControl] = useState<AiConversationControl | null>(null);
  const [aiSkippedMessage, setAiSkippedMessage] = useState<string | null>(null);
  const [canManageAiControl, setCanManageAiControl] = useState(false);
  const [aiControlLoading, setAiControlLoading] = useState(false);
  const [aiControlSaving, setAiControlSaving] = useState<AiConversationStatus | null>(null);
  const conversationId = conversation?.id;
  const hasUnread = (conversation?.unread_count ?? 0) > 0;

  const fetchAiConversationControl = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      if (!conversationId) {
        setAiControl(null);
        setAiSkippedMessage(null);
        setCanManageAiControl(false);
        return;
      }

      if (options.showLoading) setAiControlLoading(true);
      try {
        const res = await fetch(`/api/ai-chatbot/conversations/${conversationId}`, {
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as Partial<AiConversationControlResponse> & {
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setAiControl(body.control ?? null);
        setAiSkippedMessage(body.lastSkippedMessage ?? null);
        setCanManageAiControl(Boolean(body.canManage));
      } catch (error) {
        console.error("Failed to fetch AI conversation control:", error);
        setAiControl(null);
        setAiSkippedMessage(null);
        setCanManageAiControl(false);
      } finally {
        if (options.showLoading) setAiControlLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/members")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMembers((data.members as WorkspaceMemberOption[] | undefined) ?? []);
      })
      .catch((error) => {
        if (!cancelled) console.error("Failed to fetch team members:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 24-hour session timer
  const sessionInfo = useMemo(() => {
    if (!messages.length) return { expired: false, remaining: "" };

    // Find last customer message
    const lastCustomerMsg = [...messages]
      .reverse()
      .find((m) => m.sender_type === "customer");

    if (!lastCustomerMsg) return { expired: true, remaining: "No customer messages" };

    const hoursSince = differenceInHours(new Date(), new Date(lastCustomerMsg.created_at));
    const expired = hoursSince >= 24;

    if (expired) {
      return { expired: true, remaining: "Expired" };
    }

    const hoursLeft = 24 - hoursSince;
    const remaining =
      hoursLeft >= 1
        ? `${Math.floor(hoursLeft)}h remaining`
        : `${Math.floor(hoursLeft * 60)}m remaining`;

    return { expired, remaining };
  }, [messages]);

  // Store latest callback in a ref so fetchMessages doesn't need to
  // depend on `onMessagesLoaded` — otherwise parent re-renders cause
  // fetchMessages to change → useEffect re-fires → refetch → realtime
  // UPDATE on conversations.unread_count → parent re-renders → LOOP.
  // The ref is written inside an effect so the mutation doesn't happen
  // during render (React 19 refs rule); consumers only read `.current`
  // inside the async fetch completion, which runs after the render.
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  useEffect(() => {
    onMessagesLoadedRef.current = onMessagesLoaded;
  });

  // Fetch messages whenever the selected conversation changes. Kept
  // separate from the unread-reset effect so that incoming messages
  // arriving while the thread is open don't trigger a full refetch —
  // they only flip hasUnread, which only the reset effect listens to.
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch messages:", error);
      } else {
        onMessagesLoadedRef.current(data ?? []);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setAssignmentHistory([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("assignment_history")
      .select("id, assigned_to_user_id, assigned_by_user_id, reason, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!cancelled) setAssignmentHistory((data as AssignmentHistoryRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setAiControl(null);
      setAiSkippedMessage(null);
      setCanManageAiControl(false);
      return;
    }

    void fetchAiConversationControl({ showLoading: true });
  }, [conversationId, fetchAiConversationControl]);

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    void fetchAiConversationControl();
  }, [conversationId, messages.length, fetchAiConversationControl]);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`ai-conversation-control:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_conversation_controls",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void fetchAiConversationControl();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchAiConversationControl]);

  // Reactions: fetch + realtime per conversation. Subscribing here (not at
  // the page level) keeps the channel scoped to the visible conversation,
  // matching the message fetch effect above and avoiding cross-conversation
  // chatter on a busy inbox.
  useEffect(() => {
    if (!conversationId) {
      setReactions([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .eq("conversation_id", conversationId);
      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch reactions:", error);
        return;
      }
      setReactions((data as MessageReaction[]) ?? []);
    })();

    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            // Swap any matching optimistic temp row for the real one so
            // the pill doesn't double up after a successful POST.
            const tempIdx = prev.findIndex(
              (r) =>
                r.id.startsWith("temp-") &&
                r.message_id === row.message_id &&
                r.actor_type === row.actor_type &&
                r.actor_id === row.actor_id,
            );
            if (tempIdx >= 0) {
              const copy = prev.slice();
              copy[tempIdx] = row;
              return copy;
            }
            return [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const old = payload.old as Partial<MessageReaction>;
          if (!old?.id) return;
          setReactions((prev) => prev.filter((r) => r.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Clear any in-progress reply draft when the active conversation changes —
  // a quote pulled from conversation A shouldn't bleed into conversation B.
  useEffect(() => {
    setReplyTo(null);
  }, [conversationId]);

  // Reset the server-side unread_count to 0 whenever an unread count
  // surfaces on the active conversation — covers both (a) opening a
  // conversation that had unread messages and (b) new messages arriving
  // while the user is already viewing the thread (webhook server-bumps
  // unread_count to N+1; the realtime UPDATE propagates it into the
  // client, which re-runs this effect and flips it back to 0).
  //
  // Guarding on hasUnread prevents the eq-update loop: once unread_count
  // is 0 the condition is false, so no further UPDATE is issued.
  useEffect(() => {
    if (!conversationId || !hasUnread) return;
    const supabase = createClient();
    supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId)
      .then(({ error }) => {
        if (error) console.error("Failed to reset unread_count:", error);
      });
  }, [conversationId, hasUnread]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (text: string, replyToId?: string) => {
      if (!conversation) return;

      const tempId = `temp-${Date.now()}`;

      // Optimistic update — shows the message immediately with "sending" status
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "text",
        content_text: text,
        status: "sending",
        created_at: new Date().toISOString(),
        reply_to_message_id: replyToId,
      };
      onNewMessage(optimisticMsg);
      setReplyTo(null);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "text",
            content_text: text,
            reply_to_message_id: replyToId,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send message:", reason);
          toast.error(`Failed to send: ${reason}`);
          // Mark the optimistic bubble as failed so the user sees what happened
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        // Success — the realtime INSERT event will replace the temp bubble
        // with the real DB row. If realtime hasn't arrived yet, at least
        // flip status to 'sent' so the UI stops showing "sending".
        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send message:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Failed to send: ${reason}`);
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage]
  );

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!conversation) return;

      const supabase = createClient();
      await supabase
        .from("conversations")
        .update({ status })
        .eq("id", conversation.id);

      onStatusChange(conversation.id, status);
    },
    [conversation, onStatusChange]
  );

  const handleOpenTemplates = useCallback(() => {
    setTemplateModalOpen(true);
  }, []);

  const handleSendTemplate = useCallback(
    async (template: MessageTemplate, params: string[]) => {
      if (!conversation) return;

      const renderedBody = renderTemplateBody(template.body_text, params);
      const tempId = `temp-${Date.now()}`;

      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "template",
        content_text: renderedBody,
        template_name: template.name,
        status: "sending",
        created_at: new Date().toISOString(),
      };
      onNewMessage(optimisticMsg);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "template",
            template_name: template.name,
            template_params: params,
            content_text: renderedBody,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send template:", reason);
          toast.error(`Failed to send template: ${reason}`);
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send template:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Failed to send template: ${reason}`);
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage],
  );

  // Build a quick id → Message map so reply quotes can be rendered without
  // an extra fetch — the thread already holds the full conversation.
  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Bucket reactions by their target message_id for O(1) per-bubble lookup.
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    for (const r of reactions) {
      const bucket = map.get(r.message_id);
      if (bucket) bucket.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  const contactDisplayName = contact?.name || contact?.phone || "Customer";

  // Author label for a quoted message: "You" when we sent the parent,
  // contact name when the customer sent it.
  const authorLabelFor = useCallback(
    (m: Message): string => {
      const isAgentMsg =
        m.sender_type === "agent" || m.sender_type === "bot";
      return isAgentMsg ? "You" : contactDisplayName;
    },
    [contactDisplayName],
  );

  const handleStartReply = useCallback(
    (msg: Message) => {
      setReplyTo({
        id: msg.id,
        authorLabel: authorLabelFor(msg),
        preview: buildReplyPreview(msg),
      });
    },
    [authorLabelFor],
  );

  // Single reaction-set primitive. emoji === "" removes; otherwise adds/swaps.
  // The "toggle" semantic (pill click) is computed at the call site where the
  // current reactions for the bubble are already in scope — keeps this
  // function dependency-free w.r.t. the reaction list.
  const postReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.id || !conversation) {
        console.warn("[reactions] missing user or conversation");
        return;
      }
      if (messageId.startsWith("temp-")) {
        toast.error("Wait for the message to finish sending");
        return;
      }

      const convId = conversation.id;
      const userId = user.id;
      let snapshot: MessageReaction[] = [];

      // Functional updater — captures the freshest reactions list, never a
      // stale closure. Snapshot stored for rollback on POST failure.
      setReactions((prev) => {
        snapshot = prev;
        const own = prev.find(
          (r) =>
            r.message_id === messageId &&
            r.actor_type === "agent" &&
            r.actor_id === userId,
        );
        if (emoji === "") return own ? prev.filter((r) => r !== own) : prev;
        if (own) return prev.map((r) => (r === own ? { ...own, emoji } : r));
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            message_id: messageId,
            conversation_id: convId,
            actor_type: "agent",
            actor_id: userId,
            emoji,
            created_at: new Date().toISOString(),
          },
        ];
      });

      try {
        const res = await fetch("/api/whatsapp/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, emoji }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Reaction failed: ${reason}`);
        setReactions(snapshot);
      }
    },
    [conversation, user?.id],
  );

  const handleAssignChange = useCallback(
    async (agentId: string | null) => {
      if (!conversation) return;

      const res = await fetch("/api/team/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "conversation",
          target_id: conversation.id,
          assigned_to_user_id: agentId,
          reason: "manual",
        }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Failed to update assignment:", payload);
        toast.error("Failed to update assignment");
        return;
      }

      onAssignChange(conversation.id, agentId);
      setAssignmentHistory((prev) => [
        {
          id: `local-${Date.now()}`,
          assigned_to_user_id: agentId,
          assigned_by_user_id: user?.id ?? null,
          reason: "manual",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [conversation, onAssignChange, user?.id],
  );

  const updateAiConversationStatus = useCallback(
    async (status: AiConversationStatus) => {
      if (!conversation) return;
      setAiControlSaving(status);
      try {
        const res = await fetch(`/api/ai-chatbot/conversations/${conversation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const body = (await res.json().catch(() => ({}))) as Partial<AiConversationControlResponse> & {
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (body.control) setAiControl(body.control);
        setAiSkippedMessage(body.lastSkippedMessage ?? null);
        void fetchAiConversationControl();
        toast.success(
          status === "ai_active"
            ? "AI resumed for this conversation"
            : status === "ai_paused"
              ? "AI paused for this conversation"
              : "Conversation marked for human handoff",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update AI conversation control");
      } finally {
        setAiControlSaving(null);
      }
    },
    [conversation, fetchAiConversationControl],
  );

  // Empty state
  if (!conversation || !contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-950">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
          <MessageSquare className="h-8 w-8 text-slate-600" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-slate-400">
          Select a conversation
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Choose a conversation from the left to start messaging
        </p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const messageGroups = groupMessagesByDate(messages);
  const currentStatus = STATUS_OPTIONS.find(
    (s) => s.value === conversation.status
  );
  const assignedAgentId = conversation.assigned_agent_id ?? null;
  const canAssignConversation = workspace.has("assign_conversations");
  const canCloseConversation = workspace.has("close_conversations");
  const canReply = workspace.has("reply_to_conversations");
  const activeMembers = members.filter((member) => member.status === "active");
  const currentAssignee = activeMembers.find((p) => p.user_id === assignedAgentId);
  const assignLabel = assignedAgentId
    ? (currentAssignee?.full_name ?? currentAssignee?.email ?? "Assigned")
    : "Assign";

  return (
    <div className="flex flex-1 flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Back-to-list button — mobile only. Hidden on lg+ where the
              conversation list is always visible next to the thread. */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{displayName}</h2>
            <p className="truncate text-xs text-slate-400">{contact.phone}</p>
          </div>
          {/* Session timer badge — hidden on the narrowest phones so
              the name + back arrow keep their room. */}
          <Badge
            variant="outline"
            className={cn(
              "ml-1 hidden gap-1 border-slate-700 text-[10px] sm:inline-flex sm:ml-2",
              sessionInfo.expired ? "text-red-400" : "text-violet-400"
            )}
          >
            <Clock className="h-3 w-3" />
            {sessionInfo.remaining}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Status dropdown */}
          {canCloseConversation && <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                  "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-slate-800",
                  currentStatus?.color ?? "text-slate-400"
                )}>
                {currentStatus?.label ?? "Status"}
                <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-slate-700 bg-slate-800"
            >
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={cn("text-sm", opt.color)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>}

          {/* Assign dropdown */}
          {canAssignConversation && <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-slate-800",
                assignedAgentId ? "text-violet-400" : "text-slate-400"
              )}
            >
              <UserPlus className="h-3 w-3" />
              <span className="hidden sm:inline">{assignLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-slate-700 bg-slate-800"
            >
              {activeMembers.length === 0 ? (
                <DropdownMenuItem disabled className="text-sm text-slate-500">
                  No teammates available
                </DropdownMenuItem>
              ) : (
                activeMembers.map((p) => {
                  const isSelected = p.user_id === assignedAgentId;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleAssignChange(p.user_id)}
                      className={cn(
                        "text-sm",
                        isSelected ? "text-violet-400" : "text-slate-300"
                      )}
                    >
                      <span className="flex-1">
                        {p.full_name || p.email}
                        {p.user_id === user?.id ? " (me)" : ""}
                      </span>
                      {isSelected && <Check className="ml-2 h-3 w-3" />}
                    </DropdownMenuItem>
                  );
                })
              )}
              {assignedAgentId && (
                <>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem
                    onClick={() => handleAssignChange(null)}
                    className="text-sm text-slate-400"
                  >
                    Unassign
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>

      {assignmentHistory.length > 0 && (
        <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-[11px] text-slate-400">
          Last assignment: {format(new Date(assignmentHistory[0].created_at), "MMM d, h:mm a")}
          {assignmentHistory[0].reason ? ` (${assignmentHistory[0].reason})` : ""}
        </div>
      )}

      <AiConversationPanel
        control={aiControl}
        lastSkippedMessage={aiSkippedMessage}
        loading={aiControlLoading}
        savingStatus={aiControlSaving}
        canManage={canManageAiControl}
        onChangeStatus={updateAiConversationStatus}
      />

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-600">
              Send a template to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="mb-4 flex items-center justify-center">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-medium text-slate-400">
                    {formatDateSeparator(group.date)}
                  </span>
                </div>
                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((msg) => {
                    const parent = msg.reply_to_message_id
                      ? messagesById.get(msg.reply_to_message_id)
                      : null;
                    const reply = parent
                      ? {
                          authorLabel: authorLabelFor(parent),
                          preview: buildReplyPreview(parent),
                        }
                      : null;
                    const msgReactions = reactionsByMessageId.get(msg.id);
                    // Toggle is computed at the call site — `msgReactions`
                    // and `user?.id` are already in scope, no extra hook.
                    const handlePillToggle = (emoji: string) => {
                      const own = msgReactions?.find(
                        (r) =>
                          r.actor_type === "agent" &&
                          r.actor_id === user?.id,
                      );
                      const next = own?.emoji === emoji ? "" : emoji;
                      void postReaction(msg.id, next);
                    };
                    return (
                      <MessageActions
                        key={msg.id}
                        message={msg}
                        onReply={() => handleStartReply(msg)}
                        onReact={(emoji) => {
                          if (emoji) void postReaction(msg.id, emoji);
                        }}
                      >
                        <MessageBubble
                          message={msg}
                          reply={reply}
                          reactions={msgReactions}
                          currentUserId={user?.id}
                          onToggleReaction={handlePillToggle}
                        />
                      </MessageActions>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        sessionExpired={sessionInfo.expired}
        canReply={canReply}
        onSend={handleSend}
        onOpenTemplates={handleOpenTemplates}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />

      <TemplatePicker
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelect={handleSendTemplate}
      />
    </div>
  );
}

function AiConversationPanel({
  control,
  lastSkippedMessage,
  loading,
  savingStatus,
  canManage,
  onChangeStatus,
}: {
  control: AiConversationControl | null;
  lastSkippedMessage: string | null;
  loading: boolean;
  savingStatus: AiConversationStatus | null;
  canManage: boolean;
  onChangeStatus: (status: AiConversationStatus) => void;
}) {
  const status = control?.status ?? "ai_active";
  const statusLabel =
    status === "ai_active" ? "AI active" : status === "ai_paused" ? "AI paused" : "Needs human";
  const lastReplyLabel = control?.last_ai_reply_at
    ? `Last AI reply ${format(new Date(control.last_ai_reply_at), "MMM d, h:mm a")}`
    : "No AI reply recorded yet";

  return (
    <div className="border-b border-emerald-900/70 bg-[#061d15] px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-300" />
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-100">
              Conversation AI
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                status === "ai_active"
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
                  : "border-amber-300/50 bg-amber-300/15 text-amber-100",
              )}
            >
              {loading ? "Checking..." : statusLabel}
            </span>
            <span className="text-[11px] text-slate-400">{lastReplyLabel}</span>
          </div>
          {lastSkippedMessage && (
            <p className="mt-1 text-xs text-slate-300">{lastSkippedMessage}</p>
          )}
        </div>

        {canManage && (
          <div className="flex w-full flex-row flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <AiControlButton
              disabled={status === "ai_paused" || savingStatus !== null}
              icon={PauseCircle}
              label={savingStatus === "ai_paused" ? "Pausing..." : "Pause AI"}
              onClick={() => onChangeStatus("ai_paused")}
            />
            <AiControlButton
              disabled={status === "ai_active" || savingStatus !== null}
              icon={PlayCircle}
              label={savingStatus === "ai_active" ? "Resuming..." : "Resume AI"}
              onClick={() => onChangeStatus("ai_active")}
            />
            <AiControlButton
              disabled={status === "needs_human" || savingStatus !== null}
              icon={Hand}
              label={savingStatus === "needs_human" ? "Marking..." : "Mark Needs Human"}
              onClick={() => onChangeStatus("needs_human")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AiControlButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: typeof PauseCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-400/40 bg-emerald-400 px-3 text-xs font-bold text-[#07130e] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
