import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { blogArticles } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/blog");
const pageDescription =
  "Read practical TalkWagon guides about WhatsApp CRM, team inboxes, broadcasts, automations, templates, and customer communication workflows.";

export const metadata: Metadata = {
  title: "WhatsApp CRM Blog and Business Messaging Guides",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "TalkWagon Blog - WhatsApp CRM and Business Messaging Guides",
    description: pageDescription,
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: blogArticles[0].image.src,
        width: blogArticles[0].image.width,
        height: blogArticles[0].image.height,
        alt: blogArticles[0].image.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TalkWagon Blog - WhatsApp CRM Guides",
    description: pageDescription,
    images: [blogArticles[0].image.src],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BlogIndexPage() {
  return (
    <>
      <WebPageJsonLd path="/blog" name="TalkWagon Blog" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ]}
      />
      <PublicHeader active="blog" />
      <main className="bg-[#f7fbf8] text-[#07130e]">
        <section className="relative overflow-hidden bg-[#07130e] px-5 py-20 text-white sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(61,223,132,0.22),transparent_32%),linear-gradient(135deg,#07130e,#123226)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3ddf84]/35 bg-white/8 px-4 py-2 text-sm font-semibold text-[#d8fff1]">
              <BookOpen className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp CRM learning center
            </div>
            <h1 className="mt-8 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Practical WhatsApp CRM guides for growing teams
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#d8fff1]">
              Clear, source-backed guides for businesses using WhatsApp to manage customer conversations,
              greeting messages, team inboxes, broadcasts, automations, and follow-ups.
            </p>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {blogArticles.map((article, index) => (
                <article
                  key={article.slug}
                  className="overflow-hidden rounded-[30px] border border-[#dbe9e2] bg-white shadow-[0_24px_70px_rgba(7,19,14,0.08)] transition hover:border-[#3ddf84]/70"
                >
                  <Link href={article.path} className="group block">
                    <Image
                      src={article.image.src}
                      alt={article.image.alt}
                      width={article.image.width}
                      height={article.image.height}
                      className="aspect-[16/9] w-full object-cover"
                      priority={index === 0}
                    />
                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#08bba4]">
                        <span>Guide</span>
                        <span aria-hidden="true">•</span>
                        <span>{article.readingTime}</span>
                        <span aria-hidden="true">•</span>
                        <time dateTime={article.publishedDate}>
                          {new Date(`${article.publishedDate}T00:00:00Z`).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </time>
                      </div>
                      <h2 className="mt-4 text-2xl font-extrabold leading-tight text-[#07130e] group-hover:text-[#08bba4]">
                        {article.title}
                      </h2>
                      <p className="mt-4 text-base leading-7 text-[#5b7169]">{article.excerpt}</p>
                      <div className="mt-6 inline-flex items-center gap-2 font-bold text-[#07130e]">
                        Read guide
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[28px] border border-[#3ddf84]/35 bg-[#f4fff9] p-6 text-[#315345]">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                <p className="leading-7">
                  Every TalkWagon guide is written to support business decisions first: practical examples,
                  current source checks, clear limitations, and no fake performance promises.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
