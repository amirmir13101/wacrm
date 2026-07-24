import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";

import { ArticleMarkdown, extractMarkdownHeadings } from "@/components/marketing/article-markdown";
import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import type { ManagedBlogArticle } from "@/lib/marketing/blog-cms";
import { managedArticleCanonical } from "@/lib/marketing/blog-cms";
import { getCanonicalUrl } from "@/lib/site-url";

function dateLabel(value: string | null): string {
  if (!value) return "Draft preview";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function absoluteImageUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  return value.startsWith("/") ? getCanonicalUrl(value) : value;
}

function HeroImage({ article, priority = false }: { readonly article: ManagedBlogArticle; readonly priority?: boolean }) {
  if (!article.heroImageUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_30%_30%,rgba(59,220,131,0.35),transparent_30%),linear-gradient(135deg,#12392c,#07130e)] p-10 text-center text-2xl font-black text-white">
        {article.title}
      </div>
    );
  }
  if (article.heroImageUrl.startsWith("/")) {
    return (
      <Image
        src={article.heroImageUrl}
        alt={article.heroImageAlt ?? article.title}
        width={article.heroImageWidth}
        height={article.heroImageHeight}
        priority={priority}
        className="aspect-video h-auto w-full rounded-[2rem] border border-white/15 object-cover shadow-2xl"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={article.heroImageUrl}
      alt={article.heroImageAlt ?? article.title}
      width={article.heroImageWidth}
      height={article.heroImageHeight}
      loading={priority ? "eager" : "lazy"}
      className="aspect-video h-auto w-full rounded-[2rem] border border-white/15 object-cover shadow-2xl"
    />
  );
}

export function ManagedBlogArticlePage({
  article,
  preview = false,
}: {
  readonly article: ManagedBlogArticle;
  readonly preview?: boolean;
}) {
  const headings = extractMarkdownHeadings(article.contentMarkdown).filter((heading) => heading.level === 2);
  const canonical = managedArticleCanonical(article.slug);
  const image = absoluteImageUrl(article.heroImageUrl);

  return (
    <main className="min-h-screen bg-[#f6fbf8] text-[#10231d]">
      {!preview ? (
        <>
          <JsonLdScript
            id={`managed-blog-posting-${article.slug}`}
            data={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: article.title,
              description: article.description,
              url: canonical,
              mainEntityOfPage: canonical,
              datePublished: article.publishedAt,
              dateModified: article.updatedAt,
              author: { "@type": "Organization", name: article.author },
              publisher: { "@type": "Organization", name: "Talk Wagon", url: getCanonicalUrl("/") },
              ...(image ? { image: [image] } : {}),
              ...(article.primaryKeyword ? { keywords: [article.primaryKeyword, ...article.secondaryKeywords].join(", ") } : {}),
            }}
          />
          <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }, { name: "Blog", url: "/blog" }, { name: article.title, url: `/blog/${article.slug}` }]} />
          {article.faqs.length > 0 ? <FaqJsonLd id={`managed-blog-faq-${article.slug}`} faqs={article.faqs} /> : null}
        </>
      ) : null}

      <PublicHeader active="blog" />
      {preview ? (
        <div className="border-b border-amber-300/30 bg-amber-300 px-5 py-3 text-center text-sm font-black text-[#2d2507]">
          Draft preview — this article is not public.
        </div>
      ) : null}

      <article>
        <header className="overflow-hidden bg-[#071b13] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)] lg:px-8 lg:py-20">
            <div>
              <Link href="/blog" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-[#b8f6df] transition hover:border-[#3be38f]">
                <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                Back to TalkWagon blog
              </Link>
              <p className="mt-8 text-sm font-black uppercase tracking-[0.32em] text-[#41ee9f]">{article.category}</p>
              <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl">{article.title}</h1>
              <p className="mt-7 max-w-2xl text-xl leading-8 text-[#d6f7e8]">{article.excerpt}</p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#d6f7e8]">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><Clock3 className="h-4 w-4" />{article.readingTime}</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><CalendarDays className="h-4 w-4" />{dateLabel(article.publishedAt)}</span>
              </div>
            </div>
            <HeroImage article={article} priority />
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-[1.75rem] border border-[#d7eee5] bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#087d68]">Table of contents</p>
              <nav className="mt-5 space-y-1 text-sm font-bold text-[#415951]">
                {headings.length > 0 ? headings.map((heading) => (
                  <a key={heading.id} href={`#${heading.id}`} className="block rounded-2xl px-3 py-2 transition hover:bg-[#ecfff6] hover:text-[#087d68]">
                    {heading.text}
                  </a>
                )) : <p className="px-3 py-2 text-slate-500">Add H2 headings to create navigation.</p>}
                {article.faqs.length > 0 ? <a href="#faqs" className="block rounded-2xl px-3 py-2 transition hover:bg-[#ecfff6] hover:text-[#087d68]">FAQs</a> : null}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rounded-[2rem] border border-[#d7eee5] bg-white p-6 shadow-sm md:p-10">
              <div className="space-y-8">
                <ArticleMarkdown markdown={article.contentMarkdown} />
                {article.faqs.length > 0 ? (
                  <section id="faqs" className="scroll-mt-28 pt-4">
                    <h2 className="text-3xl font-black tracking-[-0.035em] text-[#10231d] md:text-4xl">Frequently asked questions</h2>
                    <div className="mt-6 space-y-4">
                      {article.faqs.map((faq) => (
                        <details key={faq.question} className="rounded-[1.25rem] border border-[#d7eee5] bg-[#f8fffb] p-5">
                          <summary className="cursor-pointer text-lg font-black text-[#10231d]">{faq.question}</summary>
                          <p className="mt-4 text-base leading-7 text-[#526960]">{faq.answer}</p>
                        </details>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
