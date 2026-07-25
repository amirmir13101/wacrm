import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const metadataPath = path.join(root, "content/blog-drafts/article-07-best-whatsapp-crm.json");
const contentPath = path.join(root, "content/blog-drafts/article-07-best-whatsapp-crm.md");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
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
const markdown = readFileSync(contentPath, "utf8");

describe("Article 07 best WhatsApp CRM managed draft", () => {
  it("keeps the approved live-Semrush keyword cluster in draft status", () => {
    expect(metadata.slug).toBe("best-whatsapp-crm");
    expect(metadata.status).toBe("draft");
    expect(metadata.primaryKeyword).toBe("best whatsapp crm");
    expect(metadata.secondaryKeywords).toEqual([
      "crm whatsapp",
      "whatsapp crm software",
      "best crm with whatsapp integration",
    ]);
    expect(metadata.seoTitle.length).toBeLessThanOrEqual(60);
    expect(metadata.description.length).toBeGreaterThanOrEqual(120);
    expect(metadata.description.length).toBeLessThanOrEqual(160);
    expect(metadata.contentFile).toBe("article-07-best-whatsapp-crm.md");
  });

  it("provides comprehensive neutral buyer guidance without a universal winner", () => {
    expect(markdown).toContain("No platform is the best choice for every company");
    expect(markdown).toContain("not a permanent ranking");
    expect(markdown).toContain("Calculate total cost, not the headline price");
    expect(markdown).toContain("A 30-day proof-of-fit plan");
    expect(markdown).toContain("TalkWagon is not affiliated");
    expect(markdown).not.toMatch(/best overall|guaranteed delivery|guaranteed results/i);
    expect((markdown.match(/^## /gm) ?? []).length).toBeGreaterThanOrEqual(12);
    expect(metadata.faqs).toHaveLength(8);
  });

  it("uses eight optimized article visuals with lazy supporting images", () => {
    const images = [
      metadata.heroImageUrl,
      ...Array.from(markdown.matchAll(/!\[[^\]]+\]\((\/hostiko-crm\/generated\/blog\/[^)]+\.webp)\)/g), (match) => match[1]),
    ];
    expect(new Set(images).size).toBe(8);
    for (const image of images) {
      expect(image.startsWith("/hostiko-crm/generated/blog/talk-wagon-")).toBe(true);
      expect(() => readFileSync(path.join(root, "public", image))).not.toThrow();
    }
  });

  it("remains absent from the code-managed public registry and static sitemap", () => {
    const registry = readFileSync(path.join(root, "src/lib/marketing/blog.ts"), "utf8");
    const sitemap = readFileSync(path.join(root, "src/app/sitemap.ts"), "utf8");
    const cms = readFileSync(path.join(root, "src/lib/marketing/blog-cms.ts"), "utf8");
    expect(registry).not.toContain('slug: "best-whatsapp-crm"');
    expect(sitemap).not.toContain("/blog/best-whatsapp-crm");
    expect(cms).toContain('.eq("status", "published")');
    expect(cms).toContain('.lte("published_at", new Date().toISOString())');
  });

  it("supports admin preview and later publication without exposing draft schema", () => {
    const managedPage = readFileSync(path.join(root, "src/components/marketing/managed-blog-article.tsx"), "utf8");
    const manager = readFileSync(path.join(root, "src/components/admin/article-manager.tsx"), "utf8");
    const editor = readFileSync(path.join(root, "src/components/admin/article-editor.tsx"), "utf8");
    expect(managedPage).toContain("Draft preview");
    expect(managedPage).toContain("!preview");
    expect(manager).toContain("/article-preview/");
    expect(editor).toContain("Save draft");
    expect(editor).toContain("Publish");
  });
});
