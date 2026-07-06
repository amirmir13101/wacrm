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

    expect(inboxPage).toContain('"flex h-full min-w-0 flex-1 lg:flex"');
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
});
