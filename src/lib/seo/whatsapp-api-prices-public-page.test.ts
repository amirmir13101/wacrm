import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public WhatsApp API prices page", () => {
  const pageSource = readSource("src/app/whatsapp-api-prices/page.tsx");
  const componentSource = readSource("src/components/marketing/whatsapp-api-prices-page.tsx");
  const headerSource = readSource("src/components/marketing/public-header.tsx");
  const footerSource = readSource("src/components/marketing/public-footer.tsx");
  const routingSource = readSource("src/lib/domain-routing.ts");
  const sitemapSource = readSource("src/app/sitemap.ts");
  const robotsSource = readSource("src/app/robots.ts");
  const dashboardPricingSource = readSource("src/components/settings/whatsapp-pricing-manager.tsx");

  it("creates a public root-domain page separate from the protected dashboard calculator", () => {
    expect(existsSync(join(process.cwd(), "src/app/whatsapp-api-prices/page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/(dashboard)/whatsapp-api-pricing/page.tsx"))).toBe(true);
    expect(routingSource).toContain("'/whatsapp-api-prices'");
    expect(routingSource).toContain("'/whatsapp-api-pricing'");
    expect(robotsSource).toContain('"/whatsapp-api-pricing"');
    expect(robotsSource).not.toContain('"/whatsapp-api-prices"');
  });

  it("reuses the existing pricing backend and calculator primitives", () => {
    expect(pageSource).toContain('from("whatsapp_pricing_rates")');
    expect(pageSource).toContain("supabaseAdmin()");
    expect(pageSource).toContain("dedupeSharedPricingRates");
    expect(pageSource).toContain("pricingRateTimeoutMs");
    expect(pageSource).toContain("Promise.race");
    expect(componentSource).toContain("calculatePricingEstimate");
    expect(componentSource).toContain("convertMicrosCurrency");
    expect(componentSource).toContain("COMMON_VIEW_CURRENCIES");
    expect(dashboardPricingSource).toContain("calculatePricingEstimate");
  });

  it("publishes SEO metadata, canonical URL, FAQ schema, and software schema", () => {
    expect(pageSource).toContain("WhatsApp API Pricing Calculator | TalkWagon");
    expect(pageSource).toContain("alternates");
    expect(pageSource).toContain("canonical: getCanonicalUrl(pagePath)");
    expect(pageSource).toContain("<WebPageJsonLd");
    expect(pageSource).toContain("<BreadcrumbJsonLd");
    expect(pageSource).toContain('<FaqJsonLd id="whatsapp-api-prices-faq-json-ld"');
    expect(pageSource).toContain('"@type": "SoftwareApplication"');
    expect(pageSource).toContain('price: "0"');
  });

  it("targets qualified pricing keywords without vendor-specific cannibalization", () => {
    expect(pageSource).toContain("WhatsApp API Pricing and Cost Calculator");
    expect(pageSource).toContain("WhatsApp business pricing");
    expect(pageSource).toContain("WhatsApp business API pricing");
    expect(pageSource).toContain("WhatsApp cloud API pricing");
    expect(componentSource).toContain("WhatsApp business API pricing rates by market and category");
    expect(componentSource).toContain("WhatsApp business cost");
    expect(componentSource).toMatch(/WhatsApp\s+for business pricing/);
    expect(componentSource).toContain("WhatsApp cloud API pricing");
    expect(`${pageSource}\n${componentSource}`.toLowerCase()).not.toContain("twilio whatsapp api pricing");
  });

  it("shows calculator fields, API category education, and the full public pricing table", () => {
    expect(componentSource).toContain("Country / market");
    expect(componentSource).toContain("Message category");
    expect(componentSource).toContain("Number of delivered messages");
    expect(componentSource).toContain("Marketing");
    expect(componentSource).toContain("Utility");
    expect(componentSource).toContain("Authentication");
    expect(componentSource).toContain("Service");
    expect(componentSource).toContain("WhatsApp business API pricing rates by market and category");
    expect(componentSource).toContain("Rate per delivered message");
  });

  it("uses relevant optimized images without replacing the live calculator data", () => {
    expect(pageSource).toContain("next/image");
    expect(componentSource).toContain("next/image");
    expect(pageSource).toContain("/hostiko-crm/generated/pricing/talk-wagon-pricing-whatsapp-api-costs-usd.webp");
    expect(componentSource).toContain("/hostiko-crm/generated/pricing/talk-wagon-pricing-whatsapp-api-costs-usd.webp");
    expect(componentSource).toContain("/hostiko-crm/generated/pricing/talk-wagon-pricing-usage-billing-analytics.webp");
    expect(pageSource).toContain("TalkWagon WhatsApp API pricing calculator dashboard illustration");
    expect(componentSource).toContain("WhatsApp API pricing calculator showing message categories and estimated costs");
    expect(componentSource).toContain("TalkWagon billing analytics dashboard showing WhatsApp message usage and plan insights");
    expect(pageSource).toContain("Visual guide only");
  });

  it("links the page from relevant public discovery surfaces", () => {
    expect(headerSource).toContain('const apiPricingNavItem = { label: "API Pricing", href: "/whatsapp-api-prices" } as const;');
    expect(headerSource).toContain('active === "api-pricing"');
    expect(footerSource).toContain("WhatsApp API Prices");
    expect(footerSource).toContain("/whatsapp-api-prices");
    expect(readSource("src/app/pricing/page.tsx")).toContain('href="/whatsapp-api-prices"');
    expect(sitemapSource).toContain('`${siteUrl}/whatsapp-api-prices`');
  });

  it("keeps claims separated between TalkWagon CRM pricing and Meta/API billing", () => {
    expect(pageSource).toContain("TalkWagon CRM subscription pricing and WhatsApp business pricing are separate");
    expect(componentSource).toContain("TalkWagon subscription pricing and WhatsApp business cost remain separate cost layers");
    expect(componentSource).toContain("Official WhatsApp pricing source");
    expect(componentSource).not.toContain("Meta charges are included");
    expect(componentSource).not.toContain("guaranteed final invoice");
  });
});
