import { getCanonicalUrl } from "@/lib/site-url";

type BreadcrumbItem = {
  readonly name: string;
  readonly url: string;
};

type JsonLdScriptProps = {
  readonly id: string;
  readonly data: Record<string, unknown>;
};

type FaqItem = {
  readonly question: string;
  readonly answer: string;
};

export function JsonLdScript({ id, data }: JsonLdScriptProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationWebSiteJsonLd() {
  const siteUrl = getCanonicalUrl("/");
  const organizationId = `${siteUrl}#organization`;

  return (
    <JsonLdScript
      id="talk-wagon-organization-website-json-ld"
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": organizationId,
            name: "Talk Wagon",
            url: siteUrl,
            logo: getCanonicalUrl("/hostiko-crm/brand/talk-wagon-logo-public.png"),
          },
          {
            "@type": "WebSite",
            "@id": `${siteUrl}#website`,
            name: "Talk Wagon",
            url: siteUrl,
            publisher: {
              "@id": organizationId,
            },
          },
        ],
      }}
    />
  );
}

export function WebPageJsonLd({
  path,
  name,
  description,
}: {
  readonly path: string;
  readonly name: string;
  readonly description: string;
}) {
  const url = getCanonicalUrl(path);

  return (
    <JsonLdScript
      id={`webpage-json-ld-${path.replace(/[^a-z0-9]+/gi, "-") || "home"}`}
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name,
        description,
        url,
        isPartOf: {
          "@type": "WebSite",
          name: "Talk Wagon",
          url: getCanonicalUrl("/"),
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  readonly items: readonly BreadcrumbItem[];
}) {
  return (
    <JsonLdScript
      id={`breadcrumb-json-ld-${items.at(-1)?.url.replace(/[^a-z0-9]+/gi, "-") ?? "page"}`}
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: getCanonicalUrl(item.url),
        })),
      }}
    />
  );
}

export function FaqJsonLd({
  id,
  faqs,
}: {
  readonly id: string;
  readonly faqs: readonly FaqItem[];
}) {
  return (
    <JsonLdScript
      id={id}
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      }}
    />
  );
}
