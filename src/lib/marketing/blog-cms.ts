import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/automations/admin-client";
import { blogArticles } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

export type ManagedBlogStatus = "draft" | "published";

export interface ManagedBlogFaq {
  readonly question: string;
  readonly answer: string;
}

export interface ManagedBlogArticle {
  readonly id: string;
  readonly slug: string;
  readonly status: ManagedBlogStatus;
  readonly title: string;
  readonly seoTitle: string;
  readonly description: string;
  readonly excerpt: string;
  readonly contentMarkdown: string;
  readonly category: string;
  readonly author: string;
  readonly readingTime: string;
  readonly primaryKeyword: string | null;
  readonly secondaryKeywords: ReadonlyArray<string>;
  readonly heroImageUrl: string | null;
  readonly heroImageAlt: string | null;
  readonly heroImageWidth: number;
  readonly heroImageHeight: number;
  readonly faqs: ReadonlyArray<ManagedBlogFaq>;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BlogArticleInput {
  readonly slug: string;
  readonly status: ManagedBlogStatus;
  readonly title: string;
  readonly seoTitle: string;
  readonly description: string;
  readonly excerpt: string;
  readonly contentMarkdown: string;
  readonly category: string;
  readonly author: string;
  readonly readingTime: string;
  readonly primaryKeyword: string | null;
  readonly secondaryKeywords: ReadonlyArray<string>;
  readonly heroImageUrl: string | null;
  readonly heroImageAlt: string | null;
  readonly heroImageWidth: number;
  readonly heroImageHeight: number;
  readonly faqs: ReadonlyArray<ManagedBlogFaq>;
}

interface BlogArticleRow {
  readonly id: string;
  readonly slug: string;
  readonly status: ManagedBlogStatus;
  readonly title: string;
  readonly seo_title: string;
  readonly description: string;
  readonly excerpt: string;
  readonly content_markdown: string;
  readonly category: string;
  readonly author: string;
  readonly reading_time: string;
  readonly primary_keyword: string | null;
  readonly secondary_keywords: ReadonlyArray<string> | null;
  readonly hero_image_url: string | null;
  readonly hero_image_alt: string | null;
  readonly hero_image_width: number;
  readonly hero_image_height: number;
  readonly faqs: unknown;
  readonly published_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface BlogCmsSummary {
  readonly codeManaged: number;
  readonly managedPublished: number;
  readonly drafts: number;
  readonly total: number;
}

export class BlogCmsUnavailableError extends Error {
  constructor(message = "Blog publishing is not ready. Apply migration 061_blog_article_management.sql first.") {
    super(message);
    this.name = "BlogCmsUnavailableError";
  }
}

function publicBlogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isFaq(value: unknown): value is ManagedBlogFaq {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.question === "string" && typeof candidate.answer === "string";
}

function mapRow(row: BlogArticleRow): ManagedBlogArticle {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    seoTitle: row.seo_title,
    description: row.description,
    excerpt: row.excerpt,
    contentMarkdown: row.content_markdown,
    category: row.category,
    author: row.author,
    readingTime: row.reading_time,
    primaryKeyword: row.primary_keyword,
    secondaryKeywords: row.secondary_keywords ?? [],
    heroImageUrl: row.hero_image_url,
    heroImageAlt: row.hero_image_alt,
    heroImageWidth: row.hero_image_width,
    heroImageHeight: row.hero_image_height,
    faqs: Array.isArray(row.faqs) ? row.faqs.filter(isFaq) : [],
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function managedArticlePath(slug: string): string {
  return `/blog/${slug}`;
}

export function managedArticleCanonical(slug: string): string {
  return getCanonicalUrl(managedArticlePath(slug));
}

export async function listPublishedManagedArticles(): Promise<ReadonlyArray<ManagedBlogArticle>> {
  const client = publicBlogClient();
  if (!client) return [];

  const { data, error } = await client
    .from("blog_articles")
    .select("*")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as BlogArticleRow[]).map(mapRow);
}

export async function getPublishedManagedArticle(slug: string): Promise<ManagedBlogArticle | null> {
  const client = publicBlogClient();
  if (!client) return null;

  const { data, error } = await client
    .from("blog_articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as BlogArticleRow);
}

export async function listAdminManagedArticles(): Promise<ReadonlyArray<ManagedBlogArticle>> {
  const { data, error } = await supabaseAdmin()
    .from("blog_articles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.message.includes("blog_articles")) {
      throw new BlogCmsUnavailableError();
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as BlogArticleRow[]).map(mapRow);
}

export async function getAdminManagedArticle(id: string): Promise<ManagedBlogArticle | null> {
  const { data, error } = await supabaseAdmin()
    .from("blog_articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.message.includes("blog_articles")) {
      throw new BlogCmsUnavailableError();
    }
    throw new Error(error.message);
  }
  return data ? mapRow(data as BlogArticleRow) : null;
}

export async function getBlogCmsSummary(): Promise<BlogCmsSummary> {
  const articles = await listAdminManagedArticles();
  const managedPublished = articles.filter((article) => article.status === "published").length;
  const drafts = articles.filter((article) => article.status === "draft").length;
  return {
    codeManaged: blogArticles.length,
    managedPublished,
    drafts,
    total: blogArticles.length + articles.length,
  };
}

export function toBlogArticleRow(
  input: BlogArticleInput,
  userId: string,
  existingArticle?: ManagedBlogArticle | null,
) {
  const publishedAt = input.status === "published"
    ? existingArticle?.publishedAt ?? new Date().toISOString()
    : null;
  return {
    slug: input.slug,
    status: input.status,
    title: input.title,
    seo_title: input.seoTitle,
    description: input.description,
    excerpt: input.excerpt,
    content_markdown: input.contentMarkdown,
    category: input.category,
    author: input.author,
    reading_time: input.readingTime,
    primary_keyword: input.primaryKeyword,
    secondary_keywords: [...input.secondaryKeywords],
    hero_image_url: input.heroImageUrl,
    hero_image_alt: input.heroImageAlt,
    hero_image_width: input.heroImageWidth,
    hero_image_height: input.heroImageHeight,
    faqs: input.faqs,
    published_at: publishedAt,
    updated_by: userId,
    ...(existingArticle ? {} : { created_by: userId }),
  };
}

export function isCodeManagedSlug(slug: string): boolean {
  return blogArticles.some((article) => article.slug === slug);
}
