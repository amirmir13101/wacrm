import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("AI Handoff navigation and state wiring", () => {
  const inboxPage = readSource("src/app/(dashboard)/inbox/page.tsx");
  const conversationList = readSource(
    "src/components/inbox/conversation-list.tsx",
  );
  const thread = readSource("src/components/inbox/message-thread.tsx");
  const banner = readSource("src/components/inbox/ai-thread-banner.tsx");

  it("uses a separate dashboard route instead of an inner Inbox tab", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "src/app/(dashboard)/inbox/ai-handoff/page.tsx",
        ),
      ),
    ).toBe(true);
    expect(conversationList).not.toContain('aria-label="Inbox views"');
    expect(conversationList).toContain('view = "inbox"');
    expect(conversationList).toContain("filterConversationsByView");
    expect(conversationList).toContain('if (option.value === "all") return true');
  });

  it("keeps Resume AI state synchronized with both routes", () => {
    expect(inboxPage).toContain("onAiStateChange={handleAiStateChange}");
    expect(inboxPage).toContain("view={view}");
    expect(thread).toContain("onAiStateChange(conversation.id, patch)");
    expect(banner).toContain("ai_autoreply_disabled: nextPaused");
    expect(banner).toContain("ai_handoff_summary: null");
  });
});
