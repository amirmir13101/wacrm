import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const blogData = readSource("src/lib/marketing/blog.ts");
const blogIndex = readSource("src/app/blog/page.tsx");
const articlePage = readSource("src/app/blog/delightchat-alternative/page.tsx");
const crmIntegrationArticle = readSource("src/app/blog/integrating-whatsapp-with-crm/page.tsx");
const sitemap = readSource("src/app/sitemap.ts");

describe("Article 06 DelightChat alternative guide", () => {
  it("publishes the Article 06 route with metadata and exactly one H1", () => {
    expect(blogData).toContain('slug: "delightchat-alternative"');
    expect(blogData).toContain('primaryKeyword: "delightchat alternative"');
    expect(blogData).toContain("V2.2 historical metrics only");
    expect(blogData).toContain('path: "/blog/delightchat-alternative"');
    expect(articlePage).toContain("DelightChat Alternative: A Practical Comparison for WhatsApp Teams");
    expect(articlePage).toContain("const articleJsonLd");
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it("adds BlogPosting, breadcrumb, and visible FAQ schema", () => {
    expect(articlePage).toContain('<JsonLdScript id="article-06-blogposting-json-ld"');
    expect(articlePage).toContain("<BreadcrumbJsonLd");
    expect(articlePage).toContain('<FaqJsonLd id="article-06-faq-json-ld" faqs={faqs}');

    for (const question of [
      "What is the best DelightChat alternative?",
      "Is TalkWagon a Shopify helpdesk replacement?",
      "Why do DelightChat pricing numbers differ across sources?",
      "Does a DelightChat alternative still need WhatsApp API charges?",
      "Can I migrate from DelightChat to TalkWagon in one step?",
    ]) {
      expect(articlePage).toContain(question);
    }
  });

  it("uses eight optimized WebP images with explicit dimensions and contextual placements", () => {
    const imagePaths = [
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-alternative-hero.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-alternative-decision-map.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-feature-comparison.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-inbox-channel-model.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-shopify-crm-pipeline.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-pricing-checklist.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-migration-workflow.webp",
      "public/hostiko-crm/generated/blog/talk-wagon-delightchat-choose-by-fit.webp",
    ];

    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(150 * 1024);
      expect(articlePage + blogData).toContain(path.replace("public", ""));
    }

    expect(blogData).toContain("width: 1600");
    expect(blogData).toContain("height: 900");
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(8);
    expect(articlePage).toContain("priority");
    expect(articlePage).toContain("TalkWagon comparison workspace");
  });

  it("keeps the comparison evidence-led and avoids unsupported superiority claims", () => {
    for (const phrase of [
      "Shopify-centered omnichannel support",
      "WhatsApp-first CRM",
      "TalkWagon should be evaluated differently",
      "Public pricing surfaces observed on July 24, 2026 showed different plan figures",
      "Meta or WhatsApp Business Platform messaging charges",
      "Choose by fit, not by slogans",
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/use-cases/sales",
      "/pricing",
      "/whatsapp-api-prices",
      "/wati-alternative",
    ]) {
      expect(articlePage).toContain(phrase);
    }

    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toContain("Primary keyword");
    expect(articlePage).not.toContain("Keyword Difficulty");
    expect(articlePage).not.toContain("Search volume");
    expect(articlePage).not.toContain("Semrush");
  });

  it("connects Article 06 through blog, sitemap, and a related guide", () => {
    expect(blogIndex).toContain("blogArticles.map");
    expect(sitemap).toContain('`${siteUrl}/blog/delightchat-alternative`');
    expect(crmIntegrationArticle).toContain("/blog/delightchat-alternative");
    expect(articlePage).toContain("/blog/integrating-whatsapp-with-crm");
    expect(articlePage).toContain("/blog/whatsapp-commerce-explained");
  });
});
