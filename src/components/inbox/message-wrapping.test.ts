import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Inbox message wrapping", () => {
  it("constrains the thread and message rows without horizontal scrolling", () => {
    const inboxPage = readSource("src/app/(dashboard)/inbox/page.tsx");
    const thread = readSource("src/components/inbox/message-thread.tsx");
    const actions = readSource("src/components/inbox/message-actions.tsx");

    expect(inboxPage).toContain('"flex h-full min-h-0 min-w-0 flex-1 lg:flex"');
    expect(thread).toContain("overflow-x-hidden");
    expect(actions).toContain("min-w-0 max-w-full w-full");
    expect(actions).toContain("max-w-[85%] sm:max-w-[75%]");
  });

  it("wraps sentences, preserved line breaks, and unbroken URLs inside bubbles", () => {
    const bubble = readSource("src/components/inbox/message-bubble.tsx");

    expect(bubble).toContain("min-w-0 max-w-full rounded-2xl");
    expect(bubble).toContain("whitespace-pre-wrap");
    expect(bubble).toContain("break-words");
    expect(bubble).toContain("[overflow-wrap:anywhere]");
    expect(bubble).not.toContain("whitespace-nowrap");
  });

  it("keeps the shared Inbox and AI Handoff flex chain scrollable", () => {
    const shell = readSource("src/app/(dashboard)/dashboard-shell.tsx");
    const inboxPage = readSource("src/app/(dashboard)/inbox/page.tsx");
    const list = readSource("src/components/inbox/conversation-list.tsx");
    const thread = readSource("src/components/inbox/message-thread.tsx");

    expect(shell).toContain("flex h-screen h-dvh overflow-hidden");
    expect(shell).toContain('pathname === "/inbox" || pathname.startsWith("/inbox/")');
    expect(shell).toContain('"overflow-y-hidden p-0"');
    expect(shell).toContain('"overflow-y-auto p-4 sm:p-6"');
    expect(inboxPage).toContain('flex h-full min-h-0 flex-col overflow-hidden');
    expect(inboxPage).toContain('flex min-h-0 flex-1 overflow-hidden');
    expect(inboxPage).toContain('min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden');
    expect(list).toContain('min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden');
    expect(list).toContain('min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden');
    expect(thread).toContain('min-h-0 min-w-0 flex-1 touch-pan-y');
  });

  it("keeps the mobile thread header and composer usable on narrow screens", () => {
    const thread = readSource("src/components/inbox/message-thread.tsx");
    const banner = readSource("src/components/inbox/ai-thread-banner.tsx");
    const composer = readSource("src/components/inbox/message-composer.tsx");

    expect(thread).toContain("flex shrink-0 flex-col items-stretch gap-2");
    expect(thread).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(banner).toContain("flex shrink-0 flex-col items-stretch gap-2");
    expect(banner).toContain("sm:flex-row sm:items-center");
    expect(composer).toContain("shrink-0 border-t");
    expect(composer).toContain("pb-[calc(env(safe-area-inset-bottom)+0.625rem)]");
    expect(composer).toContain("h-10 w-10 shrink-0");
    expect(composer).toContain(": \"Type a message...\"");
    expect(composer).toContain("hidden pl-11 text-[10px] text-slate-600 sm:block");
  });
});
