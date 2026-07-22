import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/whatsapp-away-message-examples/page.tsx");
const greetingArticle = readSource(
  "src/app/blog/whatsapp-business-greeting-message-examples/page.tsx"
);
const sitemap = readSource("src/app/sitemap.ts");

describe("Article 02 WhatsApp away-message guide", () => {
  it("publishes the approved route with complete metadata and one H1", () => {
    expect(blogData).toContain('slug: "whatsapp-away-message-examples"');
    expect(blogData).toContain('primaryKeyword: "whatsapp away message"');
    expect(blogData).toContain('publishedDate: "2026-07-23"');
    expect(blogData).toContain('validationStatus: "Skipped by user; Semrush API units unavailable"');
    expect(articlePage).toContain(
      "WhatsApp Away Messages: Professional Examples and Setup Guide"
    );
    expect(articlePage).toContain("const canonicalUrl = article.canonicalUrl");
    expect(articlePage).toContain('type: "article"');
    expect(articlePage).toContain('robots: { index: true, follow: true }');
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and matching visible FAQ schema", () => {
    expect(articlePage).toContain('<FaqJsonLd id="article-02-faq-json-ld"');
    expect(articlePage).toContain('id="article-02-blogposting-json-ld"');
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage).toContain('<BreadcrumbJsonLd');

    for (const question of [
      "What is a WhatsApp away message?",
      "What should I write in a WhatsApp Business away message?",
      "Is an away message the same as a greeting message?",
      "Can WhatsApp Business send an automatic reply outside business hours?",
      "Should I include an emergency contact in an away message?",
      "Do WhatsApp away messages need Meta template approval?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses four optimized WebP images with explicit dimensions and descriptive alt text", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-away-message-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-away-message-schedule.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-away-message-examples.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-away-message-human-handoff.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
    }

    expect(blogData).toContain('width: 1600');
    expect(blogData).toContain('height: 900');
    for (const path of imagePaths.slice(1)) {
      expect(articlePage).toContain(path.replace("public", ""));
    }
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(4);
    expect(blogData).toContain("automatic after-hours reply");
    expect(articlePage).toContain("business-hours schedule");
    expect(articlePage).toContain("human handoff");
  });

  it("covers the approved intent without duplicating Article 01", () => {
    for (const phrase of [
      "After-hours customer support",
      "Weekend away message",
      "Holiday closure",
      "Sales enquiry after hours",
      "Appointment or booking request",
      "Ecommerce order enquiry",
      "Unexpected response delay",
      "Small local business",
      "Urgent or emergency boundary",
      "Away-message publishing checklist",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).toContain("WhatsApp Help Center: away messages");
    expect(articlePage).toContain("Meta for Developers: WhatsApp templates overview");
    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("India keyword");
    expect(articlePage).not.toContain("Semrush");
  });

  it("cross-links the two articles and exposes Article 02 through blog and sitemap", () => {
    expect(articlePage).toContain('/blog/whatsapp-business-greeting-message-examples');
    expect(greetingArticle).toContain('/blog/whatsapp-away-message-examples');
    expect(blogIndex).toContain("article.publishedDate");
    expect(blogIndex).toContain("priority={index === 0}");
    expect(sitemap).toContain('`${siteUrl}/blog/whatsapp-away-message-examples`');
  });

  it("keeps links within approved public product and education routes", () => {
    for (const href of [
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/use-cases/sales",
      "/pricing",
    ]) {
      expect(articlePage).toContain(`href="${href}"`);
    }
  });
});
