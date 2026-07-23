import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/integrating-whatsapp-with-crm/page.tsx");
const greetingArticle = readSource(
  "src/app/blog/whatsapp-business-greeting-message-examples/page.tsx"
);
const awayArticle = readSource("src/app/blog/whatsapp-away-message-examples/page.tsx");
const quickRepliesArticle = readSource("src/app/blog/whatsapp-business-quick-replies/page.tsx");
const commerceArticle = readSource("src/app/blog/whatsapp-commerce-explained/page.tsx");
const sitemap = readSource("src/app/sitemap.ts");
const publicHeader = readSource("src/components/marketing/public-header.tsx");

describe("Article 05 WhatsApp CRM integration guide", () => {
  it("publishes the Article 05 route with metadata and exactly one H1", () => {
    expect(blogData).toContain('slug: "integrating-whatsapp-with-crm"');
    expect(blogData).toContain('primaryKeyword: "integrating whatsapp with crm"');
    expect(blogData).toContain("V2.2 historical metrics only");
    expect(blogData).toContain('path: "/blog/integrating-whatsapp-with-crm"');
    expect(articlePage).toContain("How to Integrate WhatsApp with a CRM");
    expect(articlePage).toContain("const articleJsonLd");
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and visible FAQ schema", () => {
    expect(articlePage).toContain('<JsonLdScript id="article-05-blogposting"');
    expect(articlePage).toContain("<BreadcrumbJsonLd");
    expect(articlePage).toContain('<FaqJsonLd id="article-05-faq-json-ld" faqs={faqs}');

    for (const question of [
      "What does integrating WhatsApp with CRM mean?",
      "Do I need the WhatsApp Business API to integrate WhatsApp with a CRM?",
      "What CRM data should sync from WhatsApp?",
      "Can WhatsApp CRM integration automate replies?",
      "How should a business test a WhatsApp CRM integration before launch?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses ten optimized WebP images with explicit dimensions and contextual placements", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-options.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-data-mapping.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-webhook-crm-events.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-team-ownership.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-automation-handoff.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-template-opt-in-checklist.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-testing.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-analytics.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-launch-checklist.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
      expect(articlePage + blogData).toContain(path.replace("public", ""));
    }

    expect(blogData).toContain("width: 1600");
    expect(blogData).toContain("height: 900");
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(10);
    expect(articlePage).toContain("priority");
    expect(articlePage).toContain("Five realistic ways to connect WhatsApp and CRM");
    expect(articlePage).toContain("What data should move between WhatsApp and the CRM");
    expect(articlePage).toContain("How webhooks keep the CRM updated");
  });

  it("keeps Article 05 educational and distinct from broad commercial pages", () => {
    for (const phrase of [
      "What integrating WhatsApp with CRM actually means",
      "When you need integration instead of only the WhatsApp Business App",
      "Templates, opt-in, and outbound CRM messages",
      "How automation and human handoff should work together",
      "What to test before going live",
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/use-cases/sales",
      "/pricing",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("Primary keyword");
    expect(articlePage).not.toContain("Keyword Difficulty");
    expect(articlePage).not.toContain("Search volume");
    expect(articlePage).not.toContain("Semrush");
  });

  it("connects Article 05 through blog, sitemap, related guides, and header", () => {
    expect(blogIndex).toContain("blogArticles.map");
    expect(sitemap).toContain('`${siteUrl}/blog/integrating-whatsapp-with-crm`');
    expect(greetingArticle).toContain("/blog/integrating-whatsapp-with-crm");
    expect(awayArticle).toContain("/blog/integrating-whatsapp-with-crm");
    expect(quickRepliesArticle).toContain("/blog/integrating-whatsapp-with-crm");
    expect(commerceArticle).toContain("/blog/integrating-whatsapp-with-crm");
    expect(articlePage).toContain("/blog/whatsapp-business-greeting-message-examples");
    expect(articlePage).toContain("/blog/whatsapp-away-message-examples");
    expect(articlePage).toContain("/blog/whatsapp-business-quick-replies");
    expect(articlePage).toContain("/blog/whatsapp-commerce-explained");
    expect(publicHeader).toContain('const blogNavItem = { label: "Blog", href: "/blog" } as const;');
    expect(publicHeader).not.toContain("Resources");
  });
});
