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
  const sitemapSource = readSource("src/app/sitemap.ts");

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
    expect(footerSource).toContain("Security");
    expect(footerSource).toContain("/security");
    expect(footerSource).toContain("About Us");
    expect(footerSource).toContain("Contact Us");
  });

  it("adds public information pages to the sitemap", () => {
    expect(sitemapSource).toContain('getSiteUrl()');
    expect(sitemapSource).toContain('`${siteUrl}/about`');
    expect(sitemapSource).toContain('`${siteUrl}/contact`');
    expect(sitemapSource).toContain('`${siteUrl}/privacy-policy`');
    expect(sitemapSource).toContain('`${siteUrl}/terms-and-conditions`');
    expect(sitemapSource).toContain('`${siteUrl}/refund-policy`');
    expect(sitemapSource).toContain('`${siteUrl}/security`');
  });
});
