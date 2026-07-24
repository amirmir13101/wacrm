import { NextResponse } from "next/server";

import { parseBlogArticleInput } from "@/lib/admin/blog-article-input";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import {
  BlogCmsUnavailableError,
  getBlogCmsSummary,
  isCodeManagedSlug,
  listAdminManagedArticles,
  toBlogArticleRow,
} from "@/lib/marketing/blog-cms";
import { blogArticles } from "@/lib/marketing/blog";

function errorResponse(error: unknown) {
  if (error instanceof BlogCmsUnavailableError) {
    return NextResponse.json({ error: error.message, migrationRequired: true }, { status: 503 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Article operation failed." }, { status: 500 });
}

export async function GET() {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  try {
    const [articles, summary] = await Promise.all([listAdminManagedArticles(), getBlogCmsSummary()]);
    return NextResponse.json({
      articles,
      summary,
      codeManagedArticles: blogArticles.map((article) => ({
        slug: article.slug,
        title: article.title,
        path: article.path,
        publishedDate: article.publishedDate,
        updatedDate: article.updatedDate,
      })),
    });
  } catch (error) {
    if (error instanceof BlogCmsUnavailableError) {
      return NextResponse.json({
        error: error.message,
        migrationRequired: true,
        articles: [],
        summary: {
          codeManaged: blogArticles.length,
          managedPublished: 0,
          drafts: 0,
          total: blogArticles.length,
        },
        codeManagedArticles: blogArticles.map((article) => ({
          slug: article.slug,
          title: article.title,
          path: article.path,
          publishedDate: article.publishedDate,
          updatedDate: article.updatedDate,
        })),
      }, { status: 503 });
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const parsed = parseBlogArticleInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (isCodeManagedSlug(parsed.value.slug)) {
    return NextResponse.json({ error: "This slug belongs to an existing code-managed article." }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin()
    .from("blog_articles")
    .insert(toBlogArticleRow(parsed.value, adminCheck.user.id))
    .select("id")
    .single();

  if (error) {
    if (error.code === "42P01") return errorResponse(new BlogCmsUnavailableError());
    if (error.code === "23505") return NextResponse.json({ error: "An article with this slug already exists." }, { status: 409 });
    return errorResponse(error);
  }
  return NextResponse.json({ article: data }, { status: 201 });
}
