import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/how-to-schedule-whatsapp-messages/page.tsx");
const crmIntegrationArticle = readSource("src/app/blog/integrating-whatsapp-with-crm/page.tsx");
const quickRepliesArticle = readSource("src/app/blog/whatsapp-business-quick-replies/page.tsx");
const sitemap = readSource("src/app/sitemap.ts");

describe("Article 08 schedule WhatsApp messages guide", () => {
  it("publishes the Article 08 route with metadata and exactly one H1", () => {
    expect(blogData).toContain('slug: "how-to-schedule-whatsapp-messages"');
    expect(blogData).toContain('primaryKeyword: "schedule whatsapp messages"');
    expect(blogData).toContain('path: "/blog/how-to-schedule-whatsapp-messages"');
    expect(blogData).toContain("Live Semrush connector result recorded in the Article 08 roadmap");
    expect(articlePage).toContain("How to Schedule WhatsApp Messages");
    expect(articlePage).toContain("const articleJsonLd");
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and visible FAQ schema", () => {
    expect(articlePage).toContain('<JsonLdScript id="article-08-blogposting-json-ld"');
    expect(articlePage).toContain("<BreadcrumbJsonLd");
    expect(articlePage).toContain('<FaqJsonLd id="article-08-faq-json-ld" faqs={faqs}');

    for (const question of [
      "Can you schedule WhatsApp messages?",
      "Can WhatsApp Business schedule broadcasts?",
      "Is an away message the same as scheduling a WhatsApp message?",
      "How should a team schedule WhatsApp follow-ups safely?",
      "Do scheduled WhatsApp messages need approved templates?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses four optimized WebP images with explicit dimensions and contextual placements", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-messages-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-message-methods.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-follow-up-workflow.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-broadcast-checklist.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
      expect(articlePage + blogData).toContain(path.replace("public", ""));
    }

    expect(blogData).toContain("width: 1600");
    expect(blogData).toContain("height: 900");
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(4);
    expect(articlePage).toContain("priority");
  });

  it("keeps the scheduling article practical, source-backed, and distinct from automation pages", () => {
    for (const phrase of [
      "Five practical ways to schedule WhatsApp messages",
      "Scheduled business broadcasts",
      "Away-message schedules",
      "Template-based platform messages",
      "CRM follow-up reminders",
      "Use automation for structure, not blind sending",
      "/features/broadcasts",
      "/features/automation",
      "/features/flows",
      "/blog/integrating-whatsapp-with-crm",
      "/whatsapp-api-prices",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("Primary keyword");
    expect(articlePage).not.toContain("Keyword Difficulty");
    expect(articlePage).not.toContain("Search volume");
    expect(articlePage).not.toContain("Semrush");
  });

  it("connects Article 08 through blog, sitemap, and related articles", () => {
    expect(blogIndex).toContain("blogArticles.map");
    expect(sitemap).toContain('`${siteUrl}/blog/how-to-schedule-whatsapp-messages`');
    expect(crmIntegrationArticle).toContain("/blog/how-to-schedule-whatsapp-messages");
    expect(quickRepliesArticle).toContain("/blog/how-to-schedule-whatsapp-messages");
  });
});
