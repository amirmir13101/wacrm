import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const pages = {
  sales: readSource('src/app/use-cases/sales/page.tsx'),
  newsletter: readSource('src/app/use-cases/newsletter/page.tsx'),
  wati: readSource('src/app/wati-alternative/page.tsx'),
} as const;

const pageMetadata = [
  {
    source: pages.sales,
    route: '/use-cases/sales',
    title: 'WhatsApp Sales CRM for Leads and Follow-Ups',
    description:
      'Turn WhatsApp sales conversations into assigned leads, organized contact context, CRM pipeline stages, and timely follow-ups with Talk Wagon.',
    image:
      'public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-workflow.webp',
    imageAlt:
      'Conceptual Talk Wagon WhatsApp sales workflow with conversations, team assignment, follow-ups, and pipeline stages',
  },
  {
    source: pages.newsletter,
    route: '/use-cases/newsletter',
    title: 'WhatsApp Newsletter Software for Teams',
    description:
      'Plan opt-in WhatsApp newsletter campaigns with approved templates, audience checks, queue processing, delivery tracking, and CRM follow-ups.',
    image:
      'public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-workflow.webp',
    imageAlt:
      'Conceptual Talk Wagon WhatsApp newsletter workflow with an opt-in audience, approval checks, campaign queue, delivery status, and inbox replies',
  },
  {
    source: pages.wati,
    route: '/wati-alternative',
    title: 'WATI Alternative for WhatsApp CRM Teams',
    description:
      'Compare Talk Wagon as a WATI alternative for team inboxes, CRM workflows, broadcasts, automation, permissions, and transparent plan evaluation.',
    image:
      'public/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation.webp',
    imageAlt:
      'Conceptual Talk Wagon evaluation of WhatsApp CRM inbox, broadcast, automation, cost, and workflow-fit considerations',
  },
] as const;

describe('Batch 03 commercial landing pages', () => {
  it('creates only the three approved commercial routes with unique metadata', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const images = new Set<string>();

    for (const page of pageMetadata) {
      expect(page.source).toContain(`const path = '${page.route}'`);
      expect(page.source).toContain(`const title = '${page.title}'`);
      expect(page.source).toContain(page.description);
      expect(`${page.title} - Talk Wagon`.length).toBeGreaterThanOrEqual(50);
      expect(`${page.title} - Talk Wagon`.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeGreaterThanOrEqual(140);
      expect(page.description.length).toBeLessThanOrEqual(160);
      expect(page.source).toContain('alternates: { canonical: canonicalUrl }');
      expect(page.source).toContain("type: 'website'");
      expect(page.source).toContain("card: 'summary_large_image'");
      expect(existsSync(join(process.cwd(), page.image))).toBe(true);
      expect(statSync(join(process.cwd(), page.image)).size).toBeLessThan(
        250 * 1024
      );
      expect(page.source).toContain(page.image.replace('public', ''));
      expect(page.source).toContain(page.imageAlt);
      titles.add(page.title);
      descriptions.add(page.description);
      images.add(page.image);
    }

    expect(titles.size).toBe(3);
    expect(descriptions.size).toBe(3);
    expect(images.size).toBe(3);
    expect(
      existsSync(
        join(process.cwd(), 'src/app/(dashboard)/whatsapp-api-pricing/page.tsx')
      )
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'src/app/use-cases/sales/page.tsx'))
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'src/app/use-cases/newsletter/page.tsx'))
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'src/app/wati-alternative/page.tsx'))
    ).toBe(true);
  });

  it('preserves keyword ownership without taking terms from the existing seven pages', () => {
    expect(pages.sales).toContain("'WhatsApp sales'");
    expect(pages.sales).toContain("'WhatsApp commerce'");
    expect(pages.newsletter).toContain("'WhatsApp newsletter'");
    expect(pages.wati).toContain("'WATI alternative'");

    const batch02 = readSource('src/lib/seo/batch-02-existing-pages.test.ts');
    expect(batch02).toContain(
      'WhatsApp CRM for Team Inbox, Broadcasts and Automation'
    );
    expect(batch02).toContain(
      'WhatsApp Business API CRM Features in One Workspace'
    );
    expect(batch02).toContain(
      'WhatsApp Team Inbox for Sales, Support and Follow-Ups'
    );
    expect(batch02).toContain(
      'WhatsApp Chatbot Handoffs and Visual Automation Flows'
    );
    expect(batch02).toContain(
      'WhatsApp Automation for Follow-Ups and CRM Workflows'
    );
    expect(batch02).toContain('WhatsApp Broadcast Software With CRM Tracking');
    expect(batch02).toContain('WhatsApp API Pricing and Talk Wagon CRM Plans');
  });

  it('uses visible FAQ content and only approved schema types', () => {
    const component = readSource(
      'src/components/marketing/commercial-landing-page.tsx'
    );
    const schema = readSource('src/components/marketing/seo-json-ld.tsx');

    expect(component).toContain('<WebPageJsonLd');
    expect(component).toContain('<BreadcrumbJsonLd');
    expect(component).toContain('<FaqJsonLd');
    expect(component).toContain('{faqs.map((faq) => (');
    expect(schema).toContain('"@type": "WebPage"');
    expect(schema).toContain('"@type": "BreadcrumbList"');
    expect(schema).toContain('"@type": "FAQPage"');

    const allNewSource = `${component}\n${Object.values(pages).join('\n')}`;
    for (const prohibited of [
      '"@type": "Product"',
      '"@type": "Review"',
      '"@type": "AggregateRating"',
      'SearchAction',
    ]) {
      expect(allNewSource).not.toContain(prohibited);
    }
  });

  it('grounds the WATI comparison in dated official sources and avoids parity claims', () => {
    expect(pages.wati).toContain('https://www.wati.io/pricing/');
    expect(pages.wati).toContain(
      'https://support.wati.io/en/articles/11462993-understanding-wati-s-pricing-structure'
    );
    expect(pages.wati).toContain(
      'https://support.wati.io/en/articles/11462997-understanding-wati-s-pricing-plans'
    );
    expect(pages.wati).toContain('reviewed on July 18, 2026');
    expect(pages.wati).toContain('does not claim feature parity');
    expect(pages.wati).toContain(
      'Talk Wagon is not affiliated with, endorsed by, or sponsored by WATI'
    );
    expect(pages.wati).not.toMatch(
      /better than WATI|cheaper than WATI|all WATI features/i
    );
  });

  it('links the new pages from established public hubs and to relevant existing pages', () => {
    const features = readSource('src/app/features/page.tsx');
    const pricing = readSource('src/app/pricing/page.tsx');

    for (const route of [
      '/use-cases/sales',
      '/use-cases/newsletter',
      '/wati-alternative',
    ]) {
      expect(features).toContain(`href: "${route}"`);
    }
    expect(pricing).toContain('href="/wati-alternative"');

    expect(pages.sales).toContain("href: '/features/team-inbox'");
    expect(pages.sales).toContain("href: '/features/automation'");
    expect(pages.newsletter).toContain("href: '/features/broadcasts'");
    expect(pages.newsletter).toContain("href: '/features/team-inbox'");
    expect(pages.wati).toContain("href: '/features'");
    expect(pages.wati).toContain("href: '/pricing'");
  });

  it('publishes the finished routes in sitemap, domain routing, and public cache policy', () => {
    const sitemap = readSource('src/app/sitemap.ts');
    const routing = readSource('src/lib/domain-routing.ts');
    const nextConfig = readSource('next.config.ts');

    for (const route of [
      '/use-cases/sales',
      '/use-cases/newsletter',
      '/wati-alternative',
    ]) {
      expect(sitemap).toContain(`\`${'${siteUrl}'}${route}\``);
    }
    expect(routing).toContain("'/use-cases'");
    expect(routing).toContain("'/wati-alternative'");
    expect(nextConfig).toContain('"/use-cases/:path*"');
    expect(nextConfig).toContain('"/wati-alternative"');
  });

  it('does not alter displayed pricing or claim that Meta messaging is included', () => {
    const pricing = readSource('src/app/pricing/page.tsx');
    expect(pricing).toContain('billing: "$1 first month, then $9.90/month"');
    expect(pricing).toContain(
      'price: plan.name === "14-Day Free Trial" ? "0" : plan.name === "Pro" ? "1" : "499"'
    );
    expect(pages.sales).toContain(
      'Meta approval, messaging charges, and policy requirements remain separate'
    );
    expect(pages.newsletter).toContain('Meta WhatsApp API messaging charges');
    expect(pages.wati).toContain(
      'Talk Wagon CRM pricing is separate from Meta WhatsApp API messaging charges'
    );
  });
});
