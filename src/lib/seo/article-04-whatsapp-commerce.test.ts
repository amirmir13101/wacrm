import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/whatsapp-commerce-explained/page.tsx");
const greetingArticle = readSource(
  "src/app/blog/whatsapp-business-greeting-message-examples/page.tsx"
);
const awayArticle = readSource("src/app/blog/whatsapp-away-message-examples/page.tsx");
const quickRepliesArticle = readSource("src/app/blog/whatsapp-business-quick-replies/page.tsx");
const publicHeader = readSource("src/components/marketing/public-header.tsx");
const tawkWidget = readSource("src/components/marketing/tawk-to-widget.tsx");
const sitemap = readSource("src/app/sitemap.ts");

describe("Article 04 WhatsApp commerce explainer", () => {
  it("publishes the Article 04 route with metadata and exactly one H1", () => {
    expect(blogData).toContain('slug: "whatsapp-commerce-explained"');
    expect(blogData).toContain('primaryKeyword: "whatsapp commerce"');
    expect(blogData).toContain('publishedDate: "2026-07-24"');
    expect(blogData).toContain("V2.1 historical metrics only");
    expect(articlePage).toContain("WhatsApp Commerce: What It Is and How It Works");
    expect(articlePage).toContain("const canonicalUrl = article.canonicalUrl");
    expect(articlePage).toContain('type: "article"');
    expect(articlePage).toContain("robots: { index: true, follow: true }");
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and visible FAQ schema", () => {
    expect(articlePage).toContain('<FaqJsonLd id="article-04-faq-json-ld"');
    expect(articlePage).toContain('id="article-04-blogposting-json-ld"');
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage).toContain("<BreadcrumbJsonLd");

    for (const question of [
      "What is WhatsApp commerce?",
      "Is WhatsApp commerce the same as an online store?",
      "What is a WhatsApp catalog?",
      "Do all products qualify for WhatsApp commerce?",
      "Should customers send card details or OTPs through WhatsApp?",
      "Where does TalkWagon fit in a WhatsApp commerce workflow?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses ten optimized WebP images with explicit dimensions and contextual placements", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-definition.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-customer-journey.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-catalog-workflow.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-policy-checklist.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-team-inbox.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-automation-flow.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-analytics.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-business-examples.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-launch-checklist.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
      expect(articlePage + blogData).toContain(path.replace("public", ""));
    }

    expect(blogData).toContain('width: 1600');
    expect(blogData).toContain('height: 900');
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(10);
    expect(articlePage).toContain("priority");
    expect(articlePage).toContain("Catalog-assisted chat");
    expect(articlePage).toContain("Commerce conversations need clear team responsibilities");
    expect(articlePage).toContain("WhatsApp commerce launch checklist");
  });

  it("keeps Article 04 educational and distinct from the sales landing page", () => {
    for (const phrase of [
      "What WhatsApp commerce means",
      "WhatsApp shop and catalog concepts",
      "WhatsApp Business App versus WhatsApp Business Platform workflows",
      "Policy, eligibility, privacy, and payment communication",
      "should not ask customers to share passwords, OTPs, full payment-card numbers",
      "/use-cases/sales",
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/pricing",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).toContain("WhatsApp Business Messaging Policy and Commerce Policy");
    expect(articlePage).toContain("Meta for Developers: catalogs overview");
    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("Primary keyword");
    expect(articlePage).not.toContain("Keyword Difficulty");
    expect(articlePage).not.toContain("Search volume");
    expect(articlePage).not.toContain("Semrush");
  });

  it("connects Article 04 through blog, sitemap, related guides, header, and Talk2 paths", () => {
    expect(blogIndex).toContain("blogArticles.map");
    expect(blogIndex).toContain("article.publishedDate");
    expect(sitemap).toContain('`${siteUrl}/blog/whatsapp-commerce-explained`');
    expect(greetingArticle).toContain("/blog/whatsapp-commerce-explained");
    expect(awayArticle).toContain("/blog/whatsapp-commerce-explained");
    expect(quickRepliesArticle).toContain("/blog/whatsapp-commerce-explained");
    expect(articlePage).toContain("/blog/whatsapp-business-greeting-message-examples");
    expect(articlePage).toContain("/blog/whatsapp-away-message-examples");
    expect(articlePage).toContain("/blog/whatsapp-business-quick-replies");
    expect(publicHeader).toContain('const blogNavItem = { label: "Blog", href: "/blog" } as const;');
    expect(publicHeader).not.toContain("Resources");
    expect(tawkWidget).toContain("'/blog'");
  });
});
