import type { BlogArticleInput, ManagedBlogFaq, ManagedBlogStatus } from "@/lib/marketing/blog-cms";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CONTENT_LENGTH = 250_000;

type ParseResult =
  | { readonly ok: true; readonly value: BlogArticleInput }
  | { readonly ok: false; readonly error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stringList(value: unknown): ReadonlyArray<string> {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).slice(0, 30);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
  return [];
}

function faqList(value: unknown): ReadonlyArray<ManagedBlogFaq> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const question = text(candidate.question);
    const answer = text(candidate.answer);
    return question && answer ? [{ question, answer }] : [];
  }).slice(0, 30);
}

export function parseBlogArticleInput(value: unknown): ParseResult {
  if (!value || typeof value !== "object") return { ok: false, error: "Invalid article payload." };
  const body = value as Record<string, unknown>;
  const slug = text(body.slug).toLowerCase();
  const status = text(body.status) as ManagedBlogStatus;
  const title = text(body.title);
  const seoTitle = text(body.seoTitle);
  const description = text(body.description);
  const excerpt = text(body.excerpt);
  const contentMarkdown = typeof body.contentMarkdown === "string" ? body.contentMarkdown.trim() : "";
  const heroImageUrl = nullableText(body.heroImageUrl);
  const heroImageAlt = nullableText(body.heroImageAlt);

  if (!SLUG_PATTERN.test(slug)) return { ok: false, error: "Slug must contain lowercase words separated by hyphens." };
  if (!["draft", "published"].includes(status)) return { ok: false, error: "Article status must be draft or published." };
  if (title.length < 8 || title.length > 180) return { ok: false, error: "Title must be between 8 and 180 characters." };
  if (seoTitle.length < 8 || seoTitle.length > 180) return { ok: false, error: "SEO title must be between 8 and 180 characters." };
  if (description.length < 50 || description.length > 320) return { ok: false, error: "Meta description must be between 50 and 320 characters." };
  if (excerpt.length < 40 || excerpt.length > 500) return { ok: false, error: "Excerpt must be between 40 and 500 characters." };
  if (contentMarkdown.length > MAX_CONTENT_LENGTH) return { ok: false, error: "Article body exceeds the 250,000-character limit." };
  if (status === "published" && contentMarkdown.length < 200) return { ok: false, error: "Published articles need at least 200 characters of body content." };
  if (heroImageUrl && !heroImageUrl.startsWith("/") && !/^https:\/\//i.test(heroImageUrl)) {
    return { ok: false, error: "Hero image must use a site path or an HTTPS URL." };
  }
  if (heroImageUrl && !heroImageAlt) return { ok: false, error: "Hero image alt text is required when an image is set." };

  return {
    ok: true,
    value: {
      slug,
      status,
      title,
      seoTitle,
      description,
      excerpt,
      contentMarkdown,
      category: text(body.category) || "Guide",
      author: text(body.author) || "TalkWagon Editorial Team",
      readingTime: text(body.readingTime) || "8 min read",
      primaryKeyword: nullableText(body.primaryKeyword),
      secondaryKeywords: stringList(body.secondaryKeywords),
      heroImageUrl,
      heroImageAlt,
      heroImageWidth: positiveInteger(body.heroImageWidth, 1600),
      heroImageHeight: positiveInteger(body.heroImageHeight, 900),
      faqs: faqList(body.faqs),
    },
  };
}
