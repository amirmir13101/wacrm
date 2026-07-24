import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractMarkdownHeadings, headingId } from "@/components/marketing/article-markdown";
import { parseBlogArticleInput } from "@/lib/admin/blog-article-input";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const validInput = {
  slug: "useful-whatsapp-guide",
  status: "draft",
  title: "A useful WhatsApp guide for growing teams",
  seoTitle: "A useful WhatsApp guide for growing teams",
  description: "A detailed description that clearly explains what readers will learn from this practical article.",
  excerpt: "A concise and useful summary for the TalkWagon blog listing and article hero section.",
  contentMarkdown: "## Introduction\n\nUseful content for readers.\n\n## Setup steps\n\nMore practical information.",
  category: "Guide",
  author: "TalkWagon Editorial Team",
  readingTime: "8 min read",
  primaryKeyword: "whatsapp guide",
  secondaryKeywords: ["business messaging"],
  heroImageUrl: "/hostiko-crm/generated/blog/example.webp",
  heroImageAlt: "TalkWagon dashboard showing a business messaging workflow",
  heroImageWidth: 1600,
  heroImageHeight: 900,
  faqs: [{ question: "Is this useful?", answer: "Yes, when it matches the business workflow." }],
};

describe("admin blog article management", () => {
  it("validates safe draft and publish inputs", () => {
    expect(parseBlogArticleInput(validInput).ok).toBe(true);
    expect(parseBlogArticleInput({ ...validInput, status: "published", contentMarkdown: "Useful content. ".repeat(20) }).ok).toBe(true);
    expect(parseBlogArticleInput({ ...validInput, slug: "Unsafe Slug" })).toEqual({
      ok: false,
      error: "Slug must contain lowercase words separated by hyphens.",
    });
    expect(parseBlogArticleInput({ ...validInput, status: "published", contentMarkdown: "Too short" })).toEqual({
      ok: false,
      error: "Published articles need at least 200 characters of body content.",
    });
  });

  it("extracts stable table-of-contents headings", () => {
    expect(headingId("Setup & Testing: A Guide")).toBe("setup-testing-a-guide");
    expect(extractMarkdownHeadings("## Start here\nText\n### Details\n## Final checks")).toEqual([
      { id: "start-here", text: "Start here", level: 2 },
      { id: "details", text: "Details", level: 3 },
      { id: "final-checks", text: "Final checks", level: 2 },
    ]);
  });

  it("adds an additive RLS-protected article table", () => {
    const migration = read("supabase/migrations/061_blog_article_management.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.blog_articles");
    expect(migration).toContain("status IN ('draft', 'published')");
    expect(migration).toContain("ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain('CREATE POLICY "Published blog articles are public"');
    expect(migration).toContain("GRANT ALL ON TABLE public.blog_articles TO service_role");
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/);
  });

  it("provides admin counts, draft editing, preview, and publish controls", () => {
    const manager = read("src/components/admin/article-manager.tsx");
    const editor = read("src/components/admin/article-editor.tsx");
    const shell = read("src/components/admin/platform-admin-shell.tsx");
    const summary = read("src/app/api/admin/summary/route.ts");
    expect(manager).toContain("All articles");
    expect(manager).toContain("Published");
    expect(manager).toContain("Drafts");
    expect(manager).toContain("Code managed");
    expect(manager).toContain("/article-preview/");
    expect(editor).toContain("Save draft");
    expect(editor).toContain("Publish article");
    expect(editor).toContain("Full preview");
    expect(editor).toContain("Article body (Markdown)");
    expect(shell).toContain('{ href: "/admin/articles", label: "Articles"');
    expect(summary).toContain("published_articles");
    expect(summary).toContain("draft_articles");
  });

  it("keeps drafts private and exposes only published managed articles", () => {
    const repository = read("src/lib/marketing/blog-cms.ts");
    const route = read("src/app/blog/[slug]/page.tsx");
    const sitemap = read("src/app/sitemap.ts");
    expect(repository).toContain('.eq("status", "published")');
    expect(repository).toContain('.lte("published_at", new Date().toISOString())');
    expect(route).toContain("getPublishedManagedArticle");
    expect(sitemap).toContain("listPublishedManagedArticles");
  });

  it("preserves existing code-managed articles as published, previewable content", () => {
    const manager = read("src/components/admin/article-manager.tsx");
    const api = read("src/app/api/admin/articles/route.ts");
    expect(manager).toContain("Existing published articles");
    expect(manager).toContain("preserve their custom layouts");
    expect(api).toContain("codeManagedArticles: blogArticles.map");
    expect(api).toContain("isCodeManagedSlug");
  });
});
