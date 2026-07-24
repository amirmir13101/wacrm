import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/automations/admin-client";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { blogArticles } from "@/lib/marketing/blog";

export async function GET() {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const admin = supabaseAdmin();
  const [pending, approved, suspended, imports, rows, publishedArticles, draftArticles] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "suspended"),
    admin.from("admin_contact_imports").select("id", { count: "exact", head: true }),
    admin.from("admin_contact_import_rows").select("id", { count: "exact", head: true }),
    admin.from("blog_articles").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("blog_articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);

  const error = pending.error ?? approved.error ?? suspended.error ?? imports.error ?? rows.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    pending_users: pending.count ?? 0,
    approved_users: approved.count ?? 0,
    suspended_users: suspended.count ?? 0,
    uploaded_lists: imports.count ?? 0,
    uploaded_contacts: rows.count ?? 0,
    published_articles: blogArticles.length + (publishedArticles.error ? 0 : publishedArticles.count ?? 0),
    draft_articles: draftArticles.error ? 0 : draftArticles.count ?? 0,
  });
}
