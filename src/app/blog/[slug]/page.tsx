import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ManagedBlogArticlePage } from "@/components/marketing/managed-blog-article";
import { getPublishedManagedArticle, managedArticleCanonical } from "@/lib/marketing/blog-cms";

interface ManagedArticlePageProps {
  readonly params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: ManagedArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedManagedArticle(slug);
  if (!article) return {};
  const canonical = managedArticleCanonical(slug);
  const images = article.heroImageUrl ? [{
    url: article.heroImageUrl,
    width: article.heroImageWidth,
    height: article.heroImageHeight,
    alt: article.heroImageAlt ?? article.title,
  }] : [];
  return {
    title: article.seoTitle,
    description: article.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.seoTitle,
      description: article.description,
      url: canonical,
      siteName: "Talk Wagon",
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.description,
      images: article.heroImageUrl ? [article.heroImageUrl] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ManagedArticlePage({ params }: ManagedArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedManagedArticle(slug);
  if (!article) notFound();
  return <ManagedBlogArticlePage article={article} />;
}
