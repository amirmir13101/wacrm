import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

type DraftMetadata = {
  slug: string;
  status: string;
  title: string;
  seoTitle: string;
  description: string;
  contentFile: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  heroImageUrl: string;
  faqs: Array<{ question: string; answer: string }>;
};

const drafts = [
  {
    metadataFile: "article-09-how-to-broadcast-on-whatsapp.json",
    slug: "how-to-broadcast-on-whatsapp",
    primaryKeyword: "how to broadcast on whatsapp",
    image: "/hostiko-crm/generated/blog/talk-wagon-how-to-broadcast-on-whatsapp-hero.webp",
    requiredPhrases: ["Consent and opt-out rules", "Template and message structure", "TalkWagon's [broadcast workflow]"],
  },
  {
    metadataFile: "article-14-whatsapp-business-message-template.json",
    slug: "whatsapp-business-message-template",
    primaryKeyword: "whatsapp business message template",
    image: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-message-template-hero.webp",
    requiredPhrases: ["Template messages versus quick replies", "Template categories", "Template library governance"],
  },
  {
    metadataFile: "article-18-whatsapp-bericht-plannen.json",
    slug: "whatsapp-bericht-plannen",
    primaryKeyword: "whatsapp bericht plannen",
    image: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-hero.webp",
    requiredPhrases: ["Inhoud", "Toestemming en klantverwachting", "Hoe TalkWagon helpt"],
  },
  {
    metadataFile: "article-20-whatsapp-event-invitation-messages.json",
    slug: "whatsapp-event-invitation-messages",
    primaryKeyword: "whatsapp message for event invitation",
    image: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-event-invitation-messages-hero.webp",
    requiredPhrases: ["RSVP and reminder workflow", "Event invitation templates", "Follow-up after the event"],
  },
] as const;

function loadDraft(metadataFile: string) {
  const metadataPath = path.join(root, "content/blog-drafts", metadataFile);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as DraftMetadata;
  const markdown = readFileSync(path.join(root, "content/blog-drafts", metadata.contentFile), "utf8");
  return { metadata, markdown };
}

describe("Article 09, 14, 18, and 20 managed drafts", () => {
  it("keeps every new article in managed draft status with approved keyword ownership", () => {
    for (const draft of drafts) {
      const { metadata } = loadDraft(draft.metadataFile);
      expect(metadata.slug).toBe(draft.slug);
      expect(metadata.status).toBe("draft");
      expect(metadata.primaryKeyword).toBe(draft.primaryKeyword);
      expect(metadata.seoTitle.length).toBeLessThanOrEqual(60);
      expect(metadata.description.length).toBeGreaterThanOrEqual(120);
      expect(metadata.description.length).toBeLessThanOrEqual(160);
      expect(metadata.secondaryKeywords.length).toBeGreaterThanOrEqual(3);
      expect(metadata.faqs.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("uses fresh optimized TalkWagon WebP hero images for every draft", () => {
    for (const draft of drafts) {
      const { metadata } = loadDraft(draft.metadataFile);
      expect(metadata.heroImageUrl).toBe(draft.image);
      expect(metadata.heroImageUrl).toMatch(/^\/hostiko-crm\/generated\/blog\/talk-wagon-.*\.webp$/);
      const filePath = path.join(root, "public", metadata.heroImageUrl);
      const stat = statSync(filePath);
      expect(stat.size).toBeGreaterThan(40_000);
      expect(stat.size).toBeLessThan(150_000);
    }
  });

  it("contains useful article structure without bottom source-link dumps", () => {
    for (const draft of drafts) {
      const { markdown } = loadDraft(draft.metadataFile);
      for (const phrase of draft.requiredPhrases) {
        expect(markdown).toContain(phrase);
      }
      expect(markdown).toContain("## ");
      expect(markdown).not.toMatch(/^## Sources\b/im);
      expect(markdown).not.toMatch(/^## References\b/im);
      expect(markdown).not.toMatch(/Search volume|keyword difficulty|Semrush connector/i);
    }
  });

  it("keeps drafts out of public static blog registry and sitemap until admin publication", () => {
    const registry = readFileSync(path.join(root, "src/lib/marketing/blog.ts"), "utf8");
    const sitemap = readFileSync(path.join(root, "src/app/sitemap.ts"), "utf8");
    const cms = readFileSync(path.join(root, "src/lib/marketing/blog-cms.ts"), "utf8");

    for (const draft of drafts) {
      expect(registry).not.toContain(`slug: "${draft.slug}"`);
      expect(sitemap).not.toContain(`/blog/${draft.slug}`);
    }
    expect(cms).toContain('.eq("status", "published")');
    expect(cms).toContain('.lte("published_at", new Date().toISOString())');
  });

  it("validates that the draft upsert utility is draft-only and publish-safe", () => {
    const script = readFileSync(path.join(root, "scripts/upsert-managed-blog-draft.mjs"), "utf8");
    expect(script).toContain('metadata.status !== "draft"');
    expect(script).toContain("Refusing to replace an already published article with a draft");
    expect(script).toContain("published_at: null");
  });
});
