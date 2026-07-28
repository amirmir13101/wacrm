import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const metadataPath = path.join(root, "content/blog-drafts/article-10-sleekflow-alternative.json");
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
const markdown = readFileSync(path.join(root, "content/blog-drafts", metadata.contentFile), "utf8");

const bodyImages = [
  "/hostiko-crm/generated/blog/talk-wagon-sleekflow-alternative-cost-comparison.webp",
  "/hostiko-crm/generated/blog/talk-wagon-sleekflow-alternative-inbox-migration.webp",
  "/hostiko-crm/generated/blog/talk-wagon-sleekflow-alternative-automation.webp",
  "/hostiko-crm/generated/blog/talk-wagon-sleekflow-alternative-decision-matrix.webp",
] as const;

describe("Article 10 SleekFlow alternative managed draft", () => {
  it("keeps Article 10 in managed draft status with approved keyword ownership", () => {
    expect(metadata.slug).toBe("sleekflow-alternative");
    expect(metadata.status).toBe("draft");
    expect(metadata.primaryKeyword).toBe("sleekflow alternative");
    expect(metadata.title).toContain("SleekFlow Alternative");
    expect(metadata.seoTitle.length).toBeLessThanOrEqual(60);
    expect(metadata.description.length).toBeGreaterThanOrEqual(120);
    expect(metadata.description.length).toBeLessThanOrEqual(160);
    expect(metadata.secondaryKeywords).toContain("sleekflow competitors");
    expect(metadata.secondaryKeywords).toContain("alternatives to sleekflow");
    expect(metadata.faqs.length).toBeGreaterThanOrEqual(6);
  });

  it("uses original optimized TalkWagon WebP images and no top-of-article table of contents", () => {
    const images = [metadata.heroImageUrl, ...bodyImages];
    expect(markdown).not.toMatch(/^## Table of contents\b/im);

    for (const image of images) {
      expect(image).toMatch(/^\/hostiko-crm\/generated\/blog\/talk-wagon-sleekflow-alternative-.*\.webp$/);
      const filePath = path.join(root, "public", image);
      const stat = statSync(filePath);
      expect(stat.size).toBeGreaterThan(30_000);
      expect(stat.size).toBeLessThan(150_000);
    }

    for (const image of bodyImages) {
      expect(markdown).toContain(`](${image})`);
    }
  });

  it("adds native conversion CTA blocks without misleading recurring price claims", () => {
    const ctaCount = (markdown.match(/^:::tw-cta$/gm) ?? []).length;
    expect(ctaCount).toBe(3);
    expect(markdown).toContain("Start your 14-day free trial");
    expect(markdown).toContain("1 million CRM broadcast messages for $1/month.");
    expect(markdown).toContain("Start using one of the world’s cheapest WhatsApp CRMs");
    expect(markdown).not.toMatch(/CRM access is separate|Plans include|renews at/i);
  });

  it("keeps comparison content useful and avoids source-link dumps", () => {
    expect(markdown).toContain("Monthly Active Contacts");
    expect(markdown).toContain("TalkWagon is not affiliated with SleekFlow");
    expect(markdown).toContain("[team inbox workflow](/features/team-inbox)");
    expect(markdown).toContain("[broadcast feature](/features/broadcasts)");
    expect(markdown).toContain("[WhatsApp API price estimator](/whatsapp-api-prices)");
    expect(markdown).not.toMatch(/^## Sources\b/im);
    expect(markdown).not.toMatch(/^## References\b/im);
    expect(markdown).not.toMatch(/Search volume|keyword difficulty|Semrush connector/i);
  });

  it("keeps Article 10 out of public static blog registry and sitemap until admin publication", () => {
    const registry = readFileSync(path.join(root, "src/lib/marketing/blog.ts"), "utf8");
    const sitemap = readFileSync(path.join(root, "src/app/sitemap.ts"), "utf8");
    const cms = readFileSync(path.join(root, "src/lib/marketing/blog-cms.ts"), "utf8");

    expect(registry).not.toContain('slug: "sleekflow-alternative"');
    expect(sitemap).not.toContain("/blog/sleekflow-alternative");
    expect(cms).toContain('.eq("status", "published")');
  });
});
