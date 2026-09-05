"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions";
import { cn } from "@/lib/utils";
import {
  filterConversationsByView,
  type InboxView,
} from "@/lib/inbox/conversation-filters";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, ChevronDown, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  onConversationDeleted: (conversationId: string) => void;
  view?: InboxView;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-violet-500",
  pending: "bg-amber-500",
  closed: "bg-slate-500",
};

type InboxFilter =
  | ConversationStatus
  | "all"
  | "mine"
  | "unassigned"
  | "assigned";

const TEAM_FILTER_OPTIONS: { label: string; value: InboxFilter }[] = [
  { label: "All conversations", value: "all" },
  { label: "My conversations", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
  { label: "Assigned", value: "assigned" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  onConversationDeleted,
  view = "inbox",
}: ConversationListProps) {
  const { user } = useAuth();
  const workspace = useWorkspacePermissions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleFilterOptions = TEAM_FILTER_OPTIONS.filter((option) => {
    // "All" means every conversation already authorized by database RLS.
    // Keeping it available ensures an unassigned AI handoff remains visible
    // in the normal Inbox instead of disappearing behind the "Mine" filter.
    if (option.value === "all") return true;
    if (option.value === "mine") return workspace.has("view_assigned_conversations");
    if (option.value === "unassigned") return workspace.has("view_unassigned_conversations");
    return true;
  });
  const activeFilter = visibleFilterOptions.find((o) => o.value === filter) ?? visibleFilterOptions[0];
  const effectiveFilter = activeFilter?.value ?? "mine";
  const filtered = (() => {
    let result = filterConversationsByView(conversations, view);

    // The AI Handoff tab is already a dedicated active-state filter. The
    // normal team/status dropdown remains unchanged for the main Inbox.
    if (view === "inbox") {
      if (effectiveFilter === "mine") {
        result = result.filter((c) => c.assigned_agent_id === user?.id);
      } else if (effectiveFilter === "unassigned") {
        result = result.filter((c) => !c.assigned_agent_id);
      } else if (effectiveFilter === "assigned") {
        result = result.filter((c) => !!c.assigned_agent_id);
      } else if (effectiveFilter !== "all") {
        result = result.filter((c) => c.status === effectiveFilter);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  })();

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const handleSelectForDeletion = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
  }, []);

  const handleDeleteConversation = useCallback(async () => {
    if (!selectedConversation || deletingConversation) return;
    setDeletingConversation(true);
    try {
      const response = await fetch(
        `/api/whatsapp/conversations/${selectedConversation.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete conversation");
      }

      onConversationDeleted(selectedConversation.id);
      setDeleteDialogOpen(false);
      setSelectedConversation(null);
      toast.success("Conversation deleted from CRM Inbox");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete conversation",
      );
    } finally {
      setDeletingConversation(false);
    }
  }, [deletingConversation, onConversationDeleted, selectedConversation]);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden border-r border-slate-800 bg-slate-900 lg:w-80 lg:max-w-80">
      {/* Search + Filter */}
      <div className="space-y-2 border-b border-slate-800 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="border-slate-700 bg-slate-800 pl-9 text-sm text-white placeholder-slate-500 focus:border-violet-500/50"
          />
        </div>

        {selectedConversation ? (
          <div className="flex min-h-7 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1">
            <span className="min-w-0 truncate text-xs font-medium text-red-100">
              1 conversation selected
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedConversation(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-700 hover:text-white"
                aria-label="Cancel conversation selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : view === "inbox" && <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 gap-1 px-2 text-xs text-slate-400 hover:text-white rounded-md hover:bg-slate-800">
              {activeFilter?.label ?? "All"}
              <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-slate-700 bg-slate-800"
          >
            {visibleFilterOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "text-sm",
                  filter === opt.value
                    ? "text-violet-400"
                    : "text-slate-300"
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>

      {/* Conversation Items */}
      <ScrollArea className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-slate-500">
              {view === "ai_handoff"
                ? "No conversations need human attention"
                : "No conversations found"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                onSelectForDeletion={handleSelectForDeletion}
                isSelectedForDeletion={conv.id === selectedConversation?.id}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deletingConversation) setSelectedConversation(null);
        }}
      >
        <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete conversation
            </DialogTitle>
            <DialogDescription className="space-y-2 text-slate-400">
              <span className="block">
                Are you sure you want to permanently delete this conversation and its message history from the CRM Inbox?
              </span>
              <span className="block">
                The contact will remain available in Contacts. This does not recall messages already delivered through WhatsApp.
              </span>
            </DialogDescription>
          </DialogHeader>
          <p className="truncate rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
            {selectedConversation?.contact?.name ||
              selectedConversation?.contact?.phone ||
              "Unknown contact"}
          </p>
          <DialogFooter className="border-slate-700 bg-slate-900">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingConversation}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConversation}
              disabled={deletingConversation}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deletingConversation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete conversation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  onSelectForDeletion: (conversation: Conversation) => void;
  isSelectedForDeletion: boolean;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onSelectForDeletion,
  isSelectedForDeletion,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onSelect(conversation);
  }, [onSelect, conversation]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    onSelectForDeletion(conversation);
  }, [conversation, onSelectForDeletion]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onSelectForDeletion(conversation);
      longPressTimerRef.current = null;
    }, 450);
  }, [clearLongPressTimer, conversation, onSelectForDeletion]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : "";

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={clearLongPressTimer}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      data-conversation-id={conversation.id}
      className={cn(
        "flex w-full touch-pan-y select-none items-start gap-3 px-3 py-3 text-left transition-colors [-webkit-touch-callout:none] hover:bg-slate-800/50",
        isActive && "border-l-2 border-violet-500 bg-slate-800/70",
        isSelectedForDeletion && "bg-red-500/15 ring-1 ring-inset ring-red-500/40",
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-white">
            {displayName}
          </span>
          <span className="shrink-0 text-[10px] text-slate-500">{timeAgo}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-slate-400">
            {conversation.last_message_text || "No messages yet"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[conversation.status]
              )}
              title={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
