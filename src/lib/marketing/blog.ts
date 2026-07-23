import { getCanonicalUrl } from "@/lib/site-url";

export const blogArticles = [
  {
    slug: "whatsapp-commerce-explained",
    path: "/blog/whatsapp-commerce-explained",
    title: "WhatsApp Commerce: What It Is and How It Works",
    seoTitle: "WhatsApp Commerce: What It Is and How It Works",
    description:
      "Learn what WhatsApp commerce means, how catalogs, conversations, payments, policies, team inboxes, automation, and CRM follow-ups fit together.",
    excerpt:
      "A practical explainer for businesses that want to understand WhatsApp commerce, catalogs, customer journeys, safe payment communication, and team workflows.",
    primaryKeyword: "whatsapp commerce",
    secondaryKeywords: [
      "whatsapp shop",
      "whatsapp catalog",
      "WhatsApp commerce workflow",
      "WhatsApp Business catalog",
      "conversational commerce on WhatsApp",
      "WhatsApp commerce policy",
      "WhatsApp sales workflow",
    ],
    market: "United States",
    semrush: {
      database: "us",
      volume: 320,
      kd: 14,
      cpc: 7.42,
      intent: "Informational-commercial",
      researchDate: "Previously researched; not currently revalidated",
      validationStatus: "V2.1 historical metrics only; Semrush was not revalidated for Article 04",
    },
    author: "TalkWagon Editorial Team",
    publishedDate: "2026-07-24",
    updatedDate: "2026-07-24",
    readingTime: "17 min read",
    image: {
      src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-hero.webp",
      width: 1600,
      height: 900,
      alt: "TalkWagon commerce dashboard showing a shared inbox, product catalog, and sales pipeline for WhatsApp commerce workflows",
    },
    canonicalUrl: getCanonicalUrl("/blog/whatsapp-commerce-explained"),
  },
  {
    slug: "whatsapp-business-quick-replies",
    path: "/blog/whatsapp-business-quick-replies",
    title: "WhatsApp Business Quick Replies: Setup Guide and Practical Examples",
    seoTitle: "WhatsApp Business Quick Replies: Setup Guide and Examples",
    description:
      "Learn how WhatsApp Business quick replies work, how to set shortcuts, and how to build reusable customer service, sales, order, and handoff replies.",
    excerpt:
      "A practical guide to WhatsApp Business quick replies, including setup steps, message examples, library organization, writing rules, and team review advice.",
    primaryKeyword: "whatsapp business quick replies",
    secondaryKeywords: [
      "WhatsApp quick replies",
      "quick reply messages for WhatsApp Business",
      "WhatsApp Business quick reply examples",
      "how to set quick replies in WhatsApp Business",
      "customer service quick reply templates",
      "WhatsApp saved replies",
      "WhatsApp Business reply shortcuts",
    ],
    market: "Previously researched",
    semrush: {
      database: "Previously researched",
      volume: null,
      kd: null,
      cpc: null,
      intent: "Informational",
      researchDate: "Previously researched; not revalidated for Article 03",
      validationStatus: "Semrush not revalidated because the trial expired",
    },
    author: "TalkWagon Editorial Team",
    publishedDate: "2026-07-23",
    updatedDate: "2026-07-23",
    readingTime: "15 min read",
    image: {
      src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-quick-replies-hero.webp",
      width: 1600,
      height: 900,
      alt: "TalkWagon workspace showing a WhatsApp Business quick-reply library beside a customer conversation and message composer",
    },
    canonicalUrl: getCanonicalUrl("/blog/whatsapp-business-quick-replies"),
  },
  {
    slug: "whatsapp-away-message-examples",
    path: "/blog/whatsapp-away-message-examples",
    title: "WhatsApp Away Messages: Professional Examples and Setup Guide",
    seoTitle: "WhatsApp Away Message Examples and Setup Guide",
    description:
      "Learn how WhatsApp away messages work, how to set one up, and how to write professional after-hours, weekend, holiday, support, and sales replies.",
    excerpt:
      "A practical guide to WhatsApp away messages, including current setup steps, scheduling advice, professional examples, and a checklist for clear customer expectations.",
    primaryKeyword: "whatsapp away message",
    secondaryKeywords: [
      "WhatsApp Business away message",
      "WhatsApp away message examples",
      "automatic reply WhatsApp Business",
      "WhatsApp out of office message",
      "after-hours WhatsApp message",
      "business closed message for WhatsApp",
    ],
    market: "Not validated",
    semrush: {
      database: "Not run",
      volume: null,
      kd: null,
      cpc: null,
      intent: "Informational",
      researchDate: "July 23, 2026",
      validationStatus: "Skipped by user; Semrush API units unavailable",
    },
    author: "TalkWagon Editorial Team",
    publishedDate: "2026-07-23",
    updatedDate: "2026-07-23",
    readingTime: "13 min read",
    image: {
      src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-away-message-hero.webp",
      width: 1600,
      height: 900,
      alt: "Illustrated WhatsApp away-message workflow showing an incoming enquiry, automatic after-hours reply, and organized follow-up queue",
    },
    canonicalUrl: getCanonicalUrl("/blog/whatsapp-away-message-examples"),
  },
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
