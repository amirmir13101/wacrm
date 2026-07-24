import { NextResponse } from "next/server";

import { parseBlogArticleInput } from "@/lib/admin/blog-article-input";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import {
  BlogCmsUnavailableError,
  getAdminManagedArticle,
  isCodeManagedSlug,
  toBlogArticleRow,
} from "@/lib/marketing/blog-cms";

interface ArticleRouteProps {
  readonly params: Promise<{ id: string }>;
}

function errorResponse(error: unknown) {
  if (error instanceof BlogCmsUnavailableError) {
    return NextResponse.json({ error: error.message, migrationRequired: true }, { status: 503 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Article operation failed." }, { status: 500 });
}

export async function GET(_request: Request, { params }: ArticleRouteProps) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  const { id } = await params;
  try {
    const article = await getAdminManagedArticle(id);
    if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: ArticleRouteProps) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  const { id } = await params;

  try {
    const existing = await getAdminManagedArticle(id);
    if (!existing) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    const parsed = parseBlogArticleInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (isCodeManagedSlug(parsed.value.slug)) {
      return NextResponse.json({ error: "This slug belongs to an existing code-managed article." }, { status: 409 });
    }

    const { error } = await supabaseAdmin()
      .from("blog_articles")
      .update(toBlogArticleRow(parsed.value, adminCheck.user.id, existing))
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "An article with this slug already exists." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: ArticleRouteProps) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  const { id } = await params;
  try {
    const existing = await getAdminManagedArticle(id);
    if (!existing) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    if (existing.status === "published") {
      return NextResponse.json({ error: "Move the article to draft before deleting it." }, { status: 409 });
    }
    const { error } = await supabaseAdmin().from("blog_articles").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
