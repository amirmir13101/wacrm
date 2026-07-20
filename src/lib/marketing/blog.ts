import { getCanonicalUrl } from "@/lib/site-url";

export const blogArticles = [
  {
    slug: "whatsapp-business-greeting-message-examples",
    path: "/blog/whatsapp-business-greeting-message-examples",
    title: "WhatsApp Business Greeting Messages: Examples and Setup Guide",
    seoTitle: "WhatsApp Business Greeting Message Examples and Setup Guide",
    description:
      "Learn what a WhatsApp Business greeting message is, how it works, and how to write useful greeting examples for support, sales, bookings, and ecommerce.",
    excerpt:
      "A practical guide to WhatsApp Business greeting messages, with setup steps, mistakes to avoid, and original examples for common business situations.",
    primaryKeyword: "whatsapp business greeting message",
    secondaryKeywords: [
      "WhatsApp greeting message",
      "WhatsApp Business greeting message examples",
      "welcome message WhatsApp",
      "business messages for WhatsApp",
    ],
    market: "India",
    semrush: {
      database: "in",
      volume: 140,
      kd: 14,
      cpc: 0,
      intent: "Informational",
      researchDate: "July 19, 2026",
    },
    author: "TalkWagon Editorial Team",
    publishedDate: "2026-07-19",
    updatedDate: "2026-07-19",
    readingTime: "12 min read",
    image: {
      src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-greeting-message-hero.webp",
      width: 1600,
      height: 900,
      alt: "TalkWagon CRM dashboard concept showing a WhatsApp Business greeting message workflow, inbox panel, settings, and setup checklist",
    },
    canonicalUrl: getCanonicalUrl("/blog/whatsapp-business-greeting-message-examples"),
  },
] as const;

export type BlogArticle = (typeof blogArticles)[number];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find((article) => article.slug === slug);
}
