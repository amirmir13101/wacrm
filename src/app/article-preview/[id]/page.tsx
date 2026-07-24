import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ManagedBlogArticlePage } from "@/components/marketing/managed-blog-article";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminManagedArticle } from "@/lib/marketing/blog-cms";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminArticlePreviewPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) redirect("/login");
  const { id } = await params;
  const article = await getAdminManagedArticle(id);
  if (!article) notFound();
  return <ManagedBlogArticlePage article={article} preview />;
}
