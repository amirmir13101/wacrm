import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public Flows feature page", () => {
  const flowsPage = readFileSync(
    join(process.cwd(), "src/app/features/flows/page.tsx"),
    "utf8",
  );
  const featuresPage = readFileSync(
    join(process.cwd(), "src/app/features/page.tsx"),
    "utf8",
  );
  const publicHeader = readFileSync(
    join(process.cwd(), "src/components/marketing/public-header.tsx"),
    "utf8",
  );
  const publicFooter = readFileSync(
    join(process.cwd(), "src/components/marketing/public-footer.tsx"),
    "utf8",
  );
  const sitemap = readFileSync(
    join(process.cwd(), "src/app/sitemap.ts"),
    "utf8",
  );

  it("creates a public /features/flows page with matching SaaS feature sections", () => {
    expect(flowsPage).toContain(
      'title: "WhatsApp Automation Flows & Visual Builder | Talk Wagon"',
    );
    expect(flowsPage).toContain(
      "Visual WhatsApp Automation Flows for Follow-Ups, Routing and Customer Journeys",
    );
    expect(flowsPage).not.toContain("Build automated customer journeys visually.");
    expect(flowsPage).toContain("Visual Flow Builder");
    expect(flowsPage).toContain("Automate customer conversations");
    expect(flowsPage).toContain("Smart conditions and branching");
    expect(flowsPage).toContain("WhatsApp Template Integration");
    expect(flowsPage).toContain("Meta/Facebook for approval");
    expect(flowsPage).toContain("Flow Runs / History");
    expect(flowsPage).toContain("General-Purpose Automation for Many Business Types");
  });

  it("uses local marketing visuals and SEO metadata for the Flows route", () => {
    expect(flowsPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-hero-overview.webp");
    expect(flowsPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-builder-nodes.webp");
    expect(flowsPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-meta-template-submission.webp");
    expect(flowsPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-run-history.webp");
    expect(flowsPage).not.toContain("unoptimized");
    expect(flowsPage).toContain("alternates");
    expect(flowsPage).toContain("openGraph");
    expect(flowsPage).toContain("FAQPage");
    expect(flowsPage).toContain("SoftwareApplication");
    expect(flowsPage).toContain("BreadcrumbList");
    expect(flowsPage).toContain('"WhatsApp automation flows"');
    expect(flowsPage).toContain('"WhatsApp flow builder"');
    expect(sitemap).toContain('url: `${siteUrl}/features/flows`');
  });

  it("updates the existing Features page with Flows and Meta Template Approval cards", () => {
    expect(featuresPage).toContain('title: "Flows"');
    expect(featuresPage).toContain('href: "/features/flows"');
    expect(featuresPage).toContain("Create visual WhatsApp automation flows");
    expect(featuresPage).toContain('title: "Meta Template Approval"');
    expect(featuresPage).toContain("submit them to Meta/Facebook for approval");
    expect(featuresPage).toContain("sync approved templates back into the CRM");
    expect(featuresPage).toContain("Build Customer Journeys and Manage Approved Messages Visually");
    expect(featuresPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-builder-nodes.webp");
    expect(featuresPage).toContain("/hostiko-crm/generated/flows/talk-wagon-flows-meta-template-submission.webp");
    expect(featuresPage).toContain('"Meta WhatsApp template approval"');
  });

  it("adds public navigation and footer links without importing protected systems", () => {
    expect(publicHeader).toContain('{ label: "Flows", href: "/features/flows" }');
    expect(publicHeader).toContain('active === "flows"');
    expect(publicFooter).toContain('["Flows", "/features/flows"]');
    expect(publicFooter).toContain('["Meta Template Approval", "/features/flows#meta-template-submission"]');

    expect(flowsPage).not.toContain("@/lib/rag");
    expect(flowsPage).not.toContain("@/lib/whatsapp");
    expect(flowsPage).not.toContain("@/lib/supabase");
    expect(flowsPage).not.toContain("createClient");
  });
});
