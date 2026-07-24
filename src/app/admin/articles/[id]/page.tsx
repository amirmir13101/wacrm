import { ArticleEditor } from "@/components/admin/article-editor";

export default async function EditAdminArticlePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticleEditor articleId={id} />;
}
