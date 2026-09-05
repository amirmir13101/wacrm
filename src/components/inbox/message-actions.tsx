"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CornerUpLeft, Copy, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Message } from "@/types";

// WhatsApp's own quick-reaction bar starts with these six. Picking the same
// set keeps the affordance familiar without pulling in a 300KB emoji library.
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageActionsProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  children: ReactNode;
}

/**
 * Hover/long-press toolbar wrapper around a `<MessageBubble>`. The bubble
 * itself stays a pure presenter — this component owns the action surface so
 * the bubble's render path is unaffected when the toolbar isn't visible.
 */
export function MessageActions({
  message,
  onReply,
  onReact,
  onDelete,
  children,
}: MessageActionsProps) {
  // Touch devices have no hover. Long-press fires `contextmenu`; we capture
  // it, suppress the native menu, and pin the toolbar open until the user
  // interacts elsewhere.
  const [touchOpen, setTouchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setTouchOpen(true);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setTouchOpen(true);
      longPressTimerRef.current = null;
    }, 450);
  };

  const handleDelete = () => {
    onDelete();
    setPickerOpen(false);
    setTouchOpen(false);
  };

  const handleCopy = async () => {
    const text = message.content_text ?? "";
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
    setTouchOpen(false);
  };

  const handlePickEmoji = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
    setTouchOpen(false);
  };

  const handleReply = () => {
    onReply();
    setTouchOpen(false);
  };

  // Row alignment lives here (not in MessageBubble) so the `group/actions`
  // hover region matches the bubble's content width — hovering empty space
  // in the row no longer reveals the toolbar.
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full w-full touch-pan-y select-none rounded-xl transition-colors [-webkit-touch-callout:none] data-[selected=true]:bg-slate-800/45",
        isAgent ? "justify-end" : "justify-start",
      )}
      data-selected={touchOpen || pickerOpen ? "true" : undefined}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={clearLongPressTimer}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onBlur={() => setTouchOpen(false)}
    >
      <div className="group/actions relative min-w-0 max-w-[85%] sm:max-w-[75%]">
        {children}
      <div
        data-touch-open={touchOpen || pickerOpen ? "true" : undefined}
        className={cn(
          "fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 flex min-h-14 max-w-[calc(100vw-1.5rem)] items-center justify-evenly gap-1 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-sm transition-opacity",
          "pointer-events-none opacity-0 data-[touch-open=true]:pointer-events-auto data-[touch-open=true]:opacity-100",
          "sm:absolute sm:inset-x-auto sm:bottom-auto sm:-top-3 sm:z-10 sm:h-7 sm:min-h-0 sm:max-w-none sm:justify-start sm:gap-0.5 sm:rounded-full sm:px-1 sm:py-0 sm:shadow-md",
          "sm:group-hover/actions:pointer-events-auto sm:group-hover/actions:opacity-100 sm:group-focus-within/actions:pointer-events-auto sm:group-focus-within/actions:opacity-100",
          isAgent ? "sm:right-3" : "sm:left-3",
        )}
      >
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            className="flex h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white sm:h-5 sm:w-5 sm:min-w-0 sm:flex-none sm:rounded-full"
            aria-label="React"
          >
            <SmilePlus className="h-3.5 w-3.5" />
            <span className="text-[10px] leading-none sm:sr-only">React</span>
          </PopoverTrigger>
          <PopoverContent
            className="flex w-auto flex-row gap-1 p-1.5"
            sideOffset={6}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handlePickEmoji(e)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-slate-700"
                aria-label={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={handleReply}
          className="flex h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white sm:h-5 sm:w-5 sm:min-w-0 sm:flex-none sm:rounded-full"
          aria-label="Reply"
        >
          <CornerUpLeft className="h-3.5 w-3.5" />
          <span className="text-[10px] leading-none sm:sr-only">Reply</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white sm:h-5 sm:w-5 sm:min-w-0 sm:flex-none sm:rounded-full"
          aria-label="Copy"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="text-[10px] leading-none sm:sr-only">Copy</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-red-300 hover:bg-red-500/20 hover:text-red-200 sm:h-5 sm:w-5 sm:min-w-0 sm:flex-none sm:rounded-full"
          aria-label="Delete message"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="text-[10px] leading-none sm:sr-only">Delete</span>
        </button>
      </div>
      </div>
    </div>
  );
}
