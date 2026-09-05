"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation, Message, Contact, ConversationStatus } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxView } from "@/lib/inbox/conversation-filters";
import { createClient } from "@/lib/supabase/client";

interface InboxWorkspacePageProps {
  view?: InboxView;
  basePath?: "/inbox" | "/inbox/ai-handoff";
}

function sortConversationsByLatest(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((left, right) => {
    const leftTime = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
    const rightTime = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function InboxWorkspacePage({
  view = "inbox",
  basePath = "/inbox",
}: InboxWorkspacePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  /**
   * `?c=<id>` deep-link support. Used when landing here from the
   * dashboard's recent-conversations list so the right thread opens
   * automatically instead of showing the empty center panel.
   */
  const deepLinkConvId = searchParams.get("c");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(
    null
  );
  const [whatsappConnectionMessage, setWhatsappConnectionMessage] = useState("");

  // Fire the deep-link auto-select exactly once per URL — subsequent
  // list refreshes (realtime, manual refetch) must not snap the user
  // back to the deep-linked conversation if they've already clicked
  // elsewhere.
  const autoSelectedForDeepLinkRef = useRef<string | null>(null);

  // Check WhatsApp connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const response = await fetch("/api/whatsapp/config");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setWhatsappConnected(payload.connected === true);
      setWhatsappConnectionMessage(payload.message ?? "");
    };

    checkConnection();
  }, []);

  // Handle realtime message events
  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;

      if (event.eventType === "DELETE") {
        const deletedId = event.old.id;
        if (deletedId) {
          setMessages((prev) => prev.filter((message) => message.id !== deletedId));
        }
        return;
      }

      if (event.eventType === "INSERT") {
        // Add to messages if it belongs to active conversation
        if (
          activeConversation &&
          newMsg.conversation_id === activeConversation.id
        ) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Replace optimistic message if it exists
            const withoutOptimistic = prev.filter(
              (m) => !m.id.startsWith("temp-")
            );
            return [...withoutOptimistic, newMsg];
          });
        }

        // Update conversation list preview
        setConversations((prev) =>
          sortConversationsByLatest(prev.map((c) =>
            c.id === newMsg.conversation_id
              ? {
                  ...c,
                  last_message_text: newMsg.content_text ?? "",
                  last_message_at: newMsg.created_at,
                  unread_count:
                    newMsg.sender_type !== "customer"
                      ? c.unread_count
                      : activeConversation?.id === newMsg.conversation_id
                        ? 0
                        : c.unread_count + 1,
                }
              : c
          ))
        );
      }

      if (event.eventType === "UPDATE") {
        // Update message status
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m))
        );
      }
    },
    [activeConversation]
  );

  // Handle realtime conversation events
  const handleConversationEvent = useCallback(
    (event: {
      eventType: string;
      new: Conversation;
      old: Partial<Conversation>;
    }) => {
      const conv = event.new;

      if (event.eventType === "DELETE") {
        const deletedId = event.old.id;
        if (deletedId) {
          setConversations((prev) => prev.filter((item) => item.id !== deletedId));
          if (activeConversation?.id === deletedId) {
            setActiveConversation(null);
            setActiveContact(null);
            setMessages([]);
            autoSelectedForDeepLinkRef.current = null;
            router.replace(basePath, { scroll: false });
          }
        }
        return;
      }

      if (event.eventType === "INSERT") {
        const supabase = createClient();
        void supabase
          .from("conversations")
          .select("*, contact:contacts(*)")
          .eq("id", conv.id)
          .maybeSingle()
          .then(({ data }) => {
            const hydrated = (data as Conversation | null) ?? conv;
            setConversations((prev) =>
              sortConversationsByLatest([
                hydrated,
                ...prev.filter((conversation) => conversation.id !== hydrated.id),
              ]),
            );
          });
      }

      if (event.eventType === "UPDATE") {
        setConversations((prev) =>
          sortConversationsByLatest(
            prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)),
          )
        );

        // Update active conversation if it changed
        if (activeConversation && conv.id === activeConversation.id) {
          setActiveConversation((prev) =>
            prev ? { ...prev, ...conv } : prev
          );
        }
      }
    },
    [activeConversation, basePath, router]
  );

  // Subscribe to realtime
  useRealtime({
    channelName: "inbox-realtime",
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: true,
  });

  const handleConversationsLoaded = useCallback(
    (loaded: Conversation[]) => {
      setConversations(loaded);
      // Resolve a pending deep-link here rather than in an effect — this
      // is an event handler, so the setState calls below are allowed by
      // react-hooks/set-state-in-effect. Runs once per ?c=<id> URL value
      // via the ref, so realtime refreshes of the list can't snap the
      // user back to the deep-linked thread after they've navigated.
      if (
        deepLinkConvId &&
        autoSelectedForDeepLinkRef.current !== deepLinkConvId &&
        loaded.length > 0
      ) {
        autoSelectedForDeepLinkRef.current = deepLinkConvId;
        // If the deep-linked conversation is already the active one
        // (e.g. because the user clicked it in the list and we
        // router.replace()'d the URL, which made the ConversationList
        // refetch and land us back here), do NOT re-apply it. Doing so
        // would setMessages([]) on a thread whose messages have
        // already been loaded by MessageThread — and because
        // conversationId didn't change, MessageThread wouldn't
        // refetch. The thread would read "No messages yet" until a
        // full page reload rehydrated state from scratch.
        if (activeConversation?.id === deepLinkConvId) return;
        const match = loaded.find((c) => c.id === deepLinkConvId);
        if (match) {
          setActiveConversation(match);
          setActiveContact(match.contact ?? null);
          setMessages([]);
        }
      }
    },
    [deepLinkConvId, activeConversation?.id]
  );

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      // Re-clicking the already-active conversation would clear the
      // messages array, but the fetch effect in MessageThread only re-runs
      // when conversationId changes — so messages would stay empty until
      // the user navigated away and back. Bail out early instead.
      if (activeConversation?.id === conv.id) return;
      setActiveConversation(conv);
      setActiveContact(conv.contact ?? null);
      setMessages([]);
      // Record the selection on the deep-link ref BEFORE we change the
      // URL. The router.replace below flips `deepLinkConvId`, which can
      // in turn cause ConversationList to refetch and eventually call
      // handleConversationsLoaded again. Without this line, the ref
      // still points at the previous value, the auto-select block
      // sees `ref !== deepLinkConvId`, fires a second time, and
      // clobbers the messages MessageThread just fetched.
      autoSelectedForDeepLinkRef.current = conv.id;
      // Reflect the selection in the URL so a refresh lands the user
      // back in the same thread, and so copy-paste links work. Use
      // replace() to avoid polluting browser history with every click.
      router.replace(`${basePath}?c=${conv.id}`, { scroll: false });
    },
    [activeConversation?.id, basePath, router]
  );

  // Mobile "back" — deselect the conversation so the list pane comes
  // back. Also clears the ?c= param so a refresh lands on the list
  // instead of re-opening the thread the user just backed out of.
  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
    // Clearing the ref lets the deep-link auto-selector fire again if
    // the user later visits /inbox?c=<same-id> — desirable UX.
    autoSelectedForDeepLinkRef.current = null;
    router.replace(basePath, { scroll: false });
  }, [basePath, router]);


  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages(loaded);
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleUpdateMessage = useCallback(
    (id: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
    },
    []
  );

  const handleStatusChange = useCallback(
    (conversationId: string, status: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, status } : prev));
      }
    },
    [activeConversation]
  );

  const handleAssignChange = useCallback(
    (conversationId: string, assignedAgentId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, assigned_agent_id: assignedAgentId ?? undefined }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev
            ? { ...prev, assigned_agent_id: assignedAgentId ?? undefined }
            : prev
        );
      }
    },
    [activeConversation]
  );

  const handleMessageDeleted = useCallback(
    (id: string, conversationPatch: Partial<Conversation>) => {
      setMessages((prev) => prev.filter((message) => message.id !== id));
      setConversations((prev) =>
        sortConversationsByLatest(
          prev.map((conversation) =>
            conversation.id === activeConversation?.id
              ? { ...conversation, ...conversationPatch }
              : conversation,
          ),
        ),
      );
      if (activeConversation) {
        setActiveConversation((prev) =>
          prev ? { ...prev, ...conversationPatch } : prev,
        );
      }
    },
    [activeConversation],
  );

  const handleConversationDeleted = useCallback(
    (conversationId: string) => {
      setConversations((prev) =>
        prev.filter((conversation) => conversation.id !== conversationId),
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setActiveContact(null);
        setMessages([]);
      }
      autoSelectedForDeepLinkRef.current = null;
      router.replace(basePath, { scroll: false });
    },
    [activeConversation?.id, basePath, router],
  );

  const handleAiStateChange = useCallback(
    (conversationId: string, patch: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, ...patch }
            : conversation,
        ),
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev ? { ...prev, ...patch } : prev,
        );
      }
    },
    [activeConversation?.id],
  );

  // On mobile (<lg) we show a SINGLE pane — either the list or the
  // thread — rather than cramming both side-by-side. Selecting a
  // conversation slides the thread in; the thread's back button pops
  // it back to the list. On lg+ both panes render side-by-side as
  // before, unchanged.
  const hasActiveConv = !!activeConversation;
  const ownerCanConnectWhatsapp =
    !whatsappConnectionMessage.toLowerCase().includes("ask the workspace owner") &&
    !whatsappConnectionMessage.toLowerCase().includes("ask the owner");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* WhatsApp connection banner — in the flex column, not absolute,
          so it pushes the panels down instead of overlapping them. */}
      {whatsappConnected === false && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-amber-400" />
          <p className="text-center text-xs font-medium text-amber-200">
            {ownerCanConnectWhatsapp
              ? "Connect your WhatsApp account in Settings to start using Inbox."
              : "Workspace WhatsApp is not connected. Ask the owner to connect it."}
          </p>
          {ownerCanConnectWhatsapp && (
            <Link
              href="/settings?tab=whatsapp"
              className="inline-flex h-7 items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Open Settings
            </Link>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel: Conversation list.
            Hidden on mobile when a conversation is selected so the
            thread can occupy the full width. Always visible on lg+. */}
        <div
          className={cn(
            "flex h-full min-h-0 flex-1 lg:flex-none",
            hasActiveConv ? "hidden lg:flex" : "flex",
          )}
        >
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
            onConversationDeleted={handleConversationDeleted}
            view={view}
          />
        </div>

        {/* Center panel: Message thread.
            Hidden on mobile when no conversation is selected so the
            list can occupy the full width. Always visible on lg+
            (shows its own empty-state if no thread is picked yet). */}
        <div
          className={cn(
            "flex h-full min-h-0 min-w-0 flex-1 lg:flex",
            hasActiveConv ? "flex" : "hidden lg:flex",
          )}
        >
          <MessageThread
            conversation={activeConversation}
            contact={activeContact}
            messages={messages}
            onMessagesLoaded={handleMessagesLoaded}
            onNewMessage={handleNewMessage}
            onUpdateMessage={handleUpdateMessage}
            onMessageDeleted={handleMessageDeleted}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            onAiStateChange={handleAiStateChange}
            onBack={handleCloseConversation}
          />
        </div>

        {/* Right panel: Contact sidebar — desktop only. */}
        <div className="hidden lg:block">
          <ContactSidebar contact={activeContact} />
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return <InboxWorkspacePage />;
}
