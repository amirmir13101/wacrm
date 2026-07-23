import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/whatsapp-business-quick-replies/page.tsx");
const greetingArticle = readSource(
  "src/app/blog/whatsapp-business-greeting-message-examples/page.tsx"
);
const awayArticle = readSource("src/app/blog/whatsapp-away-message-examples/page.tsx");
const publicHeader = readSource("src/components/marketing/public-header.tsx");
const tawkWidget = readSource("src/components/marketing/tawk-to-widget.tsx");
const sitemap = readSource("src/app/sitemap.ts");

describe("Article 03 WhatsApp Business quick replies guide", () => {
  it("publishes the approved Article 03 route with metadata and one H1", () => {
    expect(blogData).toContain('slug: "whatsapp-business-quick-replies"');
    expect(blogData).toContain('primaryKeyword: "whatsapp business quick replies"');
    expect(blogData).toContain('publishedDate: "2026-07-23"');
    expect(blogData).toContain("Semrush not revalidated because the trial expired");
    expect(articlePage).toContain(
      "WhatsApp Business Quick Replies: Setup Guide and Practical Examples"
    );
    expect(articlePage).toContain("const canonicalUrl = article.canonicalUrl");
    expect(articlePage).toContain('type: "article"');
    expect(articlePage).toContain("robots: { index: true, follow: true }");
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and visible FAQ schema", () => {
    expect(articlePage).toContain('<FaqJsonLd id="article-03-faq-json-ld"');
    expect(articlePage).toContain('id="article-03-blogposting-json-ld"');
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage).toContain("<BreadcrumbJsonLd");

    for (const question of [
      "What are WhatsApp Business quick replies?",
      "How do I set quick replies in WhatsApp Business?",
      "Are quick replies the same as automated replies?",
      "Can quick replies include customer-specific details?",
      "What should I avoid in quick replies?",
      "How many quick replies should a business create?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses eight optimized WebP images with explicit dimensions and descriptive alt text", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-quick-replies-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-quick-reply-vs-automation-comparison.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-quick-reply-library-organization.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-whatsapp-quick-reply-setup-workflow.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-quick-reply-message-examples.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-team-consistent-quick-replies.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-quick-reply-human-review-handoff.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-quick-reply-library-maintenance.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
      expect(articlePage + blogData).toContain(path.replace("public", ""));
    }

    expect(blogData).toContain('width: 1600');
    expect(blogData).toContain('height: 900');
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(8);
    expect(articlePage).toContain("priority");
    expect(articlePage).toContain("TalkWagon quick-reply library");
    expect(articlePage).toContain("human handoff");
  });

  it("keeps Article 03 focused on saved responses and shortcuts", () => {
    for (const phrase of [
      "reusable saved responses",
      "WhatsApp Business reply shortcuts",
      "Practical WhatsApp Business quick reply examples",
      "How to organize a quick-reply library",
      "Common quick-reply mistakes to avoid",
      "Practical implementation checklist",
      "/pricing",
      "/handoff",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).toContain("WhatsApp Help Center: how to use quick replies");
    expect(articlePage).toContain("Meta for Developers: WhatsApp templates overview");
    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("Primary keyword");
    expect(articlePage).not.toContain("Keyword Difficulty");
    expect(articlePage).not.toContain("Search volume");
    expect(articlePage).not.toContain("Semrush");
  });

  it("connects Article 03 through blog, sitemap, related guides, header, and Talk2 paths", () => {
    expect(blogIndex).toContain("blogArticles.map");
    expect(blogIndex).toContain("article.publishedDate");
    expect(sitemap).toContain('`${siteUrl}/blog/whatsapp-business-quick-replies`');
    expect(greetingArticle).toContain("/blog/whatsapp-business-quick-replies");
    expect(awayArticle).toContain("/blog/whatsapp-business-quick-replies");
    expect(articlePage).toContain("/blog/whatsapp-business-greeting-message-examples");
    expect(articlePage).toContain("/blog/whatsapp-away-message-examples");
    expect(publicHeader).toContain('const blogNavItem = { label: "Blog", href: "/blog" } as const;');
    expect(publicHeader).not.toContain("Resources");
    expect(tawkWidget).toContain("'/blog'");
  });

  it("keeps internal links on approved public routes", () => {
    for (const href of [
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/use-cases/sales",
      "/pricing",
    ]) {
      expect(articlePage).toContain(`href: "${href}"`);
    }
  });
});
