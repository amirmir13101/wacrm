import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = join(process.cwd(), "src/app");
const componentDir = join(process.cwd(), "src/components/marketing");

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public legal and information pages", () => {
  const headerSource = readSource("src/components/marketing/public-header.tsx");
  const footerSource = readSource("src/components/marketing/public-footer.tsx");
  const domainRoutingSource = readSource("src/lib/domain-routing.ts");
  const robotsSource = readSource("src/app/robots.ts");
  const sitemapSource = readSource("src/app/sitemap.ts");
  const rootLayoutSource = readSource("src/app/layout.tsx");
  const dashboardLayoutSource = readSource("src/app/(dashboard)/layout.tsx");
  const authLayoutSource = readSource("src/app/(auth)/layout.tsx");
  const adminLayoutSource = readSource("src/app/admin/layout.tsx");
  const dataDeletionStatusSource = readSource("src/app/data-deletion/status/page.tsx");
  const yandexMetricaSource = readSource("src/components/marketing/yandex-metrica.tsx");
  const privacySource = readSource("src/app/privacy-policy/page.tsx");

  it("creates all required public legal and information pages", () => {
    expect(existsSync(join(appDir, "privacy-policy/page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "terms-and-conditions/page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "refund-policy/page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "security/page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "about/page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "contact/page.tsx"))).toBe(true);
  });

  it("keeps the required public pages on the shared public layout", () => {
    for (const route of ["privacy-policy", "terms-and-conditions", "refund-policy", "security", "about", "contact"]) {
      const source = readFileSync(join(appDir, `${route}/page.tsx`), "utf8");

      expect(source).toContain("InfoPageShell");
      expect(source).toContain("metadata");
      expect(source).toContain("canonical");
      expect(source).toContain("openGraph");
      expect(source).toContain("twitter");
      expect(source).toContain("WebPageJsonLd");
      expect(source).toContain("BreadcrumbJsonLd");
    }
  });

  it("keeps public feature detail pages optimized with breadcrumbs and schema", () => {
    for (const route of ["team-inbox", "automation", "broadcasts", "flows"]) {
      const source = readFileSync(join(appDir, `features/${route}/page.tsx`), "utf8");

      expect(source).toContain("openGraph");
      expect(source).toContain("twitter");
      expect(source).toContain('"@type": "SoftwareApplication"');
      expect(source).toContain('"@type": "FAQPage"');
      expect(source).toContain('"@type": "BreadcrumbList"');
      expect(source).toContain('aria-label="Breadcrumb"');
      expect(source).toContain('href="/features"');
    }
  });

  it("keeps referenced marketing social images present on disk", () => {
    const publicDir = join(process.cwd(), "public");
    const sources = [
      readSource("src/app/layout.tsx"),
      readSource("src/app/page.tsx"),
      readSource("src/app/features/page.tsx"),
      readSource("src/app/features/team-inbox/page.tsx"),
      readSource("src/app/features/automation/page.tsx"),
      readSource("src/app/features/broadcasts/page.tsx"),
      readSource("src/app/features/flows/page.tsx"),
      readSource("src/app/pricing/page.tsx"),
      readSource("src/lib/seo/metadata.ts"),
    ].join("\n");
    const imagePaths = Array.from(
      sources.matchAll(/\/hostiko-crm\/generated\/[^"')\]]+\.(?:webp|png|jpg|jpeg)/g),
      (match) => match[0],
    );

    expect(imagePaths.length).toBeGreaterThan(0);
    for (const imagePath of new Set(imagePaths)) {
      expect(existsSync(join(publicDir, imagePath.replace(/^\//, "")))).toBe(true);
    }
  });

  it("mentions Berankify LTD on About Us", () => {
    const aboutSource = readFileSync(join(appDir, "about/page.tsx"), "utf8");

    expect(aboutSource).toContain("Berankify LTD");
    expect(aboutSource).toContain("one of the most affordable WhatsApp chatbot automation and CRM tools");
  });

  it("uses a working no-backend Contact Us submission path", () => {
    const contactSource = readFileSync(join(appDir, "contact/page.tsx"), "utf8");
    const contactFormSource = readFileSync(join(componentDir, "contact-message-form.tsx"), "utf8");

    expect(contactSource).toContain("ContactMessageForm");
    expect(contactFormSource).toContain("Name");
    expect(contactFormSource).toContain("Email");
    expect(contactFormSource).toContain("Business name");
    expect(contactFormSource).toContain("Subject");
    expect(contactFormSource).toContain("Message");
    expect(contactFormSource).toContain("https://wa.me/");
    expect(contactFormSource).toContain("Tawk_API");
  });

  it("removes FAQ from the top header navigation", () => {
    expect(headerSource).not.toContain('label: "FAQ"');
    expect(headerSource).not.toContain("/features#faq");
  });

  it("keeps public marketing links on the root domain after logout from the app subdomain", () => {
    expect(domainRoutingSource).toContain("export const ROOT_DOMAIN = 'talkwagon.chat'");
    expect(domainRoutingSource).toContain("export const APP_DOMAIN = 'app.talkwagon.chat'");
    expect(domainRoutingSource).toContain("marketingHrefForHost");
    expect(domainRoutingSource).toContain("appHrefForHost");
    expect(headerSource).toContain("marketingHrefForHost(item.href, currentHost)");
    expect(headerSource).toContain('appHrefForHost("/login", currentHost)');
    expect(footerSource).toContain("footerHref(href)");
    expect(footerSource).toContain("marketingHrefForHost(href, currentHost)");
    expect(footerSource).toContain("appHrefForHost(href, currentHost)");
  });

  it("keeps required legal links in the footer", () => {
    expect(footerSource).toContain("Privacy Policy");
    expect(footerSource).toContain("/privacy-policy");
    expect(footerSource).toContain("Terms of Service");
    expect(footerSource).toContain("/terms-and-conditions");
    expect(footerSource).toContain("Refund Policy");
    expect(footerSource).toContain("/refund-policy");
    expect(footerSource).toContain("Data Deletion");
    expect(footerSource).toContain("/data-deletion");
    expect(footerSource).not.toContain("/api/meta/data-deletion");
    expect(footerSource).toContain("Security");
    expect(footerSource).toContain("/security");
    expect(footerSource).toContain("About Us");
    expect(footerSource).toContain("Contact Us");
  });

  it("adds public information pages to the sitemap", () => {
    expect(sitemapSource).toContain('getSiteUrl()');
    expect(sitemapSource).toContain('`${siteUrl}/about`');
    expect(sitemapSource).toContain('`${siteUrl}/contact`');
    expect(sitemapSource).toContain('`${siteUrl}/whatsapp-api-prices`');
    expect(sitemapSource).toContain('`${siteUrl}/data-deletion`');
    expect(sitemapSource).toContain('`${siteUrl}/privacy-policy`');
    expect(sitemapSource).toContain('`${siteUrl}/terms-and-conditions`');
    expect(sitemapSource).toContain('`${siteUrl}/refund-policy`');
    expect(sitemapSource).toContain('`${siteUrl}/security`');
    expect(sitemapSource).not.toContain("app.talkwagon.chat");
    expect(sitemapSource).not.toContain('`${siteUrl}/dashboard`');
    expect(sitemapSource).not.toContain('`${siteUrl}/login`');
    expect(sitemapSource).not.toContain('`${siteUrl}/admintops`');
    expect(sitemapSource).not.toContain('`${siteUrl}/data-deletion/status`');
  });

  it("keeps robots.txt focused on public crawling and blocks private CRM routes", () => {
    expect(robotsSource).toContain('sitemap: `${siteUrl}/sitemap.xml`');
    expect(robotsSource).toContain("host: siteUrl");

    for (const blockedRoute of [
      "/api/",
      "/login",
      "/dashboard",
      "/admintops",
      "/settings",
      "/inbox",
      "/broadcasts",
      "/contacts",
      "/billing",
      "/flows",
      "/knowledge-base",
      "/whatsapp-api-pricing",
      "/data-deletion/status",
    ]) {
      expect(robotsSource).toContain(`"${blockedRoute}"`);
    }
  });

  it("marks authenticated, admin, and data deletion status routes as noindex", () => {
    for (const source of [
      dashboardLayoutSource,
      authLayoutSource,
      adminLayoutSource,
      dataDeletionStatusSource,
    ]) {
      expect(source).toContain("robots");
      expect(source).toContain("index: false");
      expect(source).toContain("follow: false");
    }
  });

  it("provides root fallback canonical and social metadata", () => {
    expect(rootLayoutSource).toContain("metadataBase: new URL(getSiteUrl())");
    expect(rootLayoutSource).toContain("alternates");
    expect(rootLayoutSource).toContain("canonical: getSiteUrl()");
    expect(rootLayoutSource).toContain("openGraph");
    expect(rootLayoutSource).toContain("twitter");
    expect(rootLayoutSource).toContain("talk-wagon-home-hero-dashboard.webp");
  });

  it("loads Yandex Metrica only for the public website host", () => {
    expect(rootLayoutSource).toContain("YandexMetrica");
    expect(yandexMetricaSource).toContain("next/script");
    expect(yandexMetricaSource).toContain("110570956");
    expect(yandexMetricaSource).toContain('"talkwagon.chat"');
    expect(yandexMetricaSource).toContain('"www.talkwagon.chat"');
    expect(yandexMetricaSource).not.toContain('"app.talkwagon.chat"');
    expect(yandexMetricaSource).not.toContain("webvisor: true");
    expect(privacySource).toContain("Yandex Metrica");
  });
});
