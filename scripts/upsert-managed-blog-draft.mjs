import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env.local"), quiet: true });

const inputPath = process.argv[2] ? resolve(root, process.argv[2]) : null;
const validateOnly = process.argv.includes("--validate-only");

if (!inputPath) {
  throw new Error("Usage: node scripts/upsert-managed-blog-draft.mjs <draft-json> [--validate-only]");
}

const metadata = JSON.parse(await readFile(inputPath, "utf8"));
const contentPath = resolve(dirname(inputPath), metadata.contentFile);
const contentMarkdown = (await readFile(contentPath, "utf8")).trim();

if (metadata.status !== "draft") throw new Error("This utility accepts draft articles only.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug)) throw new Error("Invalid draft slug.");
if (contentMarkdown.length < 200) throw new Error("Draft content is unexpectedly short.");
if (!Array.isArray(metadata.faqs)) throw new Error("Draft FAQs must be an array.");

if (validateOnly) {
  console.log(`Validated managed blog draft: ${metadata.slug}`);
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Required Supabase server environment is missing.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: lookupError } = await supabase
  .from("blog_articles")
  .select("id,status")
  .eq("slug", metadata.slug)
  .maybeSingle();

if (lookupError) throw new Error(`Draft lookup failed: ${lookupError.message}`);
if (existing?.status === "published") {
  throw new Error("Refusing to replace an already published article with a draft.");
}

const row = {
  slug: metadata.slug,
  status: "draft",
  title: metadata.title,
  seo_title: metadata.seoTitle,
  description: metadata.description,
  excerpt: metadata.excerpt,
  content_markdown: contentMarkdown,
  category: metadata.category,
  author: metadata.author,
  reading_time: metadata.readingTime,
  primary_keyword: metadata.primaryKeyword,
  secondary_keywords: metadata.secondaryKeywords,
  hero_image_url: metadata.heroImageUrl,
  hero_image_alt: metadata.heroImageAlt,
  hero_image_width: metadata.heroImageWidth,
  hero_image_height: metadata.heroImageHeight,
  faqs: metadata.faqs,
  published_at: null,
};

const query = existing
  ? supabase.from("blog_articles").update(row).eq("id", existing.id)
  : supabase.from("blog_articles").insert(row);
const { data, error } = await query.select("id,slug,status").single();

if (error) throw new Error(`Draft upsert failed: ${error.message}`);
console.log(`Managed blog draft ready: ${data.slug} (${data.status})`);
