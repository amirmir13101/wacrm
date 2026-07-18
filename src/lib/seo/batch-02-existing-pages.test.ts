import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const pages = {
  home: readSource("src/app/page.tsx"),
  features: readSource("src/app/features/page.tsx"),
  teamInbox: readSource("src/app/features/team-inbox/page.tsx"),
  flows: readSource("src/app/features/flows/page.tsx"),
  automation: readSource("src/app/features/automation/page.tsx"),
  broadcasts: readSource("src/app/features/broadcasts/page.tsx"),
  pricing: readSource("src/app/pricing/page.tsx"),
} as const;

describe("Batch 02 existing-page SEO ownership", () => {
  it("uses the approved primary and supporting phrases on their intended pages", () => {
    expect(pages.home).toContain("WhatsApp CRM for Team Inbox, Broadcasts and Automation");
    expect(pages.home).toContain("WhatsApp business CRM");
    expect(pages.features).toContain("WhatsApp Business API CRM Features in One Workspace");
    expect(pages.teamInbox).toContain("WhatsApp Team Inbox for Sales, Support and Follow-Ups");
    expect(pages.teamInbox).toContain("WhatsApp shared inbox");
    expect(pages.flows).toContain("WhatsApp Chatbot Handoffs and Visual Automation Flows");
    expect(pages.automation).toContain("WhatsApp Automation for Follow-Ups and CRM Workflows");
    expect(pages.automation).toContain("WhatsApp CRM integration");
    expect(pages.broadcasts).toContain("WhatsApp Broadcast Software With CRM Tracking");
    expect(pages.pricing).toContain("WhatsApp API Pricing and Talk Wagon CRM Plans");
  });

  it("preserves the deployed Batch 01 metadata where body optimization is sufficient", () => {
    expect(pages.features).toContain('title: "WhatsApp CRM Features for Teams and Automation"');
    expect(pages.automation).toContain('title: "WhatsApp Automation Software for CRM Follow-Ups"');
    expect(pages.broadcasts).toContain('title: "WhatsApp Broadcast Software With CRM Tracking"');
    expect(pages.pricing).toContain('title: "WhatsApp CRM Pricing and Plans for Teams"');
  });

  it("keeps API ownership and pricing limitations explicit", () => {
    expect(pages.features).toContain("business's own approved WhatsApp Business API");
    expect(pages.features).toContain("does not sell API access or control Meta charges");
    expect(pages.pricing).toContain("WhatsApp API pricing, Meta conversation charges, or provider fees are separate");
    expect(pages.pricing).toContain("Talk Wagon does not sell WhatsApp/Meta messages directly");
    expect(pages.pricing).toContain('billing: "$1 first month, then $9.90/month"');
    expect(pages.pricing).toContain('price: plan.name === "14-Day Free Trial" ? "0" : plan.name === "Pro" ? "1" : "499"');
  });

  it("renders FAQ schema from the same visible FAQ arrays", () => {
    for (const source of Object.values(pages)) {
      expect(source).toContain('"@type": "FAQPage"');
      expect(source).toContain("mainEntity: faqs.map((faq) => ({");
      expect(source).toContain("{faqs.map((faq) => (");
    }
    expect(pages.flows).toContain("How do WhatsApp chatbot handoffs work with visual flows?");
    expect(pages.pricing).toContain("How does WhatsApp API pricing relate to Talk Wagon plans?");
  });

  it("uses descriptive links between existing public pages without adding new routes", () => {
    expect(pages.home).toContain("Explore {card.title}");
    expect(pages.features).toContain("Explore {feature.title}");
    for (const route of [
      "/features/team-inbox",
      "/features/automation",
      "/features/flows",
      "/features/broadcasts",
    ]) {
      expect(pages.pricing).toContain(`href="${route}"`);
    }
  });

  it("avoids forcing a non-English supporting phrase into the English automation page", () => {
    expect(pages.automation.toLocaleLowerCase("tr-TR")).not.toContain("whatsapp entegrasyonu");
  });
});
