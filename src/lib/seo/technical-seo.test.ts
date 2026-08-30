import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const metadataFixes = [
  {
    path: "src/app/features/page.tsx",
    title: "WhatsApp CRM Features for Teams and Automation",
    description:
      "Explore Talk Wagon WhatsApp CRM software for team inboxes, contacts, visual flows, approved broadcasts, automation, permissions, analytics, and pipelines.",
  },
  {
    path: "src/app/features/automation/page.tsx",
    title: "WhatsApp Automation Software for CRM Follow-Ups",
    description:
      "Use WhatsApp automation software for follow-ups, contact updates, agent assignment, tags, deals, webhooks, wait steps, and customer workflows.",
  },
  {
    path: "src/app/features/broadcasts/page.tsx",
    title: "WhatsApp Broadcast Software With CRM Tracking",
    description:
      "Create opt-in WhatsApp broadcast software campaigns with approved templates, audience checks, team access, delivery tracking, and CRM follow-ups.",
  },
  {
    path: "src/app/pricing/page.tsx",
    title: "WhatsApp CRM Pricing and Plans for Teams",
    description:
      "Compare Talk Wagon WhatsApp CRM software plans for team inboxes, contacts, approved broadcasts, automation, analytics, and WhatsApp Business API workflows.",
  },
  {
    path: "src/app/security/page.tsx",
    title: "WhatsApp CRM Security and Data Protection",
    description:
      "Learn how Talk Wagon protects CRM workspaces with role-based permissions, protected API routes, secure WhatsApp configuration, and masked provider keys.",
  },
] as const;

describe("Batch 01 technical SEO", () => {
  it("keeps confirmed title and description fixes within practical rendered lengths", () => {
    for (const item of metadataFixes) {
      const source = readSource(item.path);
      expect(source).toContain(`title: "${item.title}"`);
      expect(source).toContain(`"${item.description}"`);
      expect(`${item.title} - Talk Wagon`.length).toBeGreaterThanOrEqual(50);
      expect(`${item.title} - Talk Wagon`.length).toBeLessThanOrEqual(60);
      expect(item.description.length).toBeGreaterThanOrEqual(140);
      expect(item.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("adds one reusable Organization and WebSite graph to the homepage", () => {
    const home = readSource("src/app/page.tsx");
    const schema = readSource("src/components/marketing/seo-json-ld.tsx");

    expect(home).toContain("<OrganizationWebSiteJsonLd />");
    expect(schema).toContain('id="talk-wagon-organization-website-json-ld"');
    expect(schema).toContain('"@type": "Organization"');
    expect(schema).toContain('"@type": "WebSite"');
    expect(schema).toContain("talk-wagon-logo-public.png");
    expect(schema).not.toContain("SearchAction");
  });

  it("uses the existing branded social image on audited public information pages", () => {
    const helper = readSource("src/lib/seo/metadata.ts");
    const imagePath = "public/hostiko-crm/generated/talk-wagon-home-hero-dashboard.webp";
    const routes = [
      "about",
      "contact",
      "data-deletion",
      "privacy-policy",
      "terms-and-conditions",
      "refund-policy",
      "security",
    ];

    expect(helper).toContain("talk-wagon-home-hero-dashboard.webp");
    expect(existsSync(join(process.cwd(), imagePath))).toBe(true);

    for (const route of routes) {
      const source = readSource(`src/app/${route}/page.tsx`);
      expect(source).toContain("images: [publicInfoSocialImage]");
      expect(source).toContain("images: [publicInfoSocialImage.url]");
    }
  });

  it("keeps pricing represented as SoftwareApplication offers with accurate billing context", () => {
    const pricing = readSource("src/app/pricing/page.tsx");

    expect(pricing).toContain('"@type": "SoftwareApplication"');
    expect(pricing).toContain('"@type": "Offer"');
    expect(pricing).not.toContain('"@type": "Product"');
    expect(pricing).toContain('price: plan.name === "14-Day Free Trial" ? "0" : plan.name === "Pro" ? "1" : "499"');
    expect(pricing).toContain("description: `${plan.description} ${plan.billing}.`");
    expect(pricing).toContain('billing: "$1 first month, then $9.99/month"');
  });

  it("keeps the sitemap public-only and robots restrictions intact", () => {
    const sitemap = readSource("src/app/sitemap.ts");
    const robots = readSource("src/app/robots.ts");

    for (const route of ["/features", "/pricing", "/about", "/contact", "/security"]) {
      expect(sitemap).toContain(`\`${"${siteUrl}"}${route}\``);
    }
    for (const privateRoute of ["/dashboard", "/inbox", "/settings", "/knowledge-base"]) {
      expect(sitemap).not.toContain(`\`${"${siteUrl}"}${privateRoute}\``);
      expect(robots).toContain(`"${privateRoute}"`);
    }
    expect(robots).toContain('sitemap: `${siteUrl}/sitemap.xml`');
  });
});
