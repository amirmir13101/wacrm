import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const watiPage = readSource('src/app/wati-alternative/page.tsx');
const commercialPage = readSource(
  'src/components/marketing/commercial-landing-page.tsx'
);
const publicHeader = readSource('src/components/marketing/public-header.tsx');
const publicFooter = readSource('src/components/marketing/public-footer.tsx');
const publicCtaButtons = readSource(
  'src/components/marketing/public-cta-buttons.tsx'
);
const sitemap = readSource('src/app/sitemap.ts');

describe('Batch 04 competitor and alternative pages', () => {
  it('keeps WATI Alternative as the only authorized competitor page owner', () => {
    expect(watiPage).toContain("const path = '/wati-alternative'");
    expect(watiPage).toContain("'WATI alternative'");
    expect(watiPage).toContain('Talk Wagon vs WATI');
    expect(sitemap).toContain('`${siteUrl}/wati-alternative`');

    for (const deferredRoute of [
      'src/app/respond-io-alternative/page.tsx',
      'src/app/aisensy-alternative/page.tsx',
      'src/app/interakt-alternative/page.tsx',
      'src/app/gallabox-alternative/page.tsx',
      'src/app/zoko-alternative/page.tsx',
      'src/app/delightchat-alternative/page.tsx',
      'src/app/trengo-alternative/page.tsx',
      'src/app/sleekflow-alternative/page.tsx',
      'src/app/doubletick-alternative/page.tsx',
    ]) {
      expect(existsSync(join(process.cwd(), deferredRoute))).toBe(false);
    }
  });

  it('renders comparison rows with a dedicated evidence/context column', () => {
    expect(commercialPage).toContain('readonly evidence?: string');
    expect(commercialPage).toContain('Evidence or important context');
    expect(commercialPage).toContain('min-w-[980px]');

    expect(watiPage).toContain('evidence:');
    expect(watiPage).toContain('official pricing-structure article');
    expect(watiPage).toContain('WATI public product and help pages reviewed');
    expect(watiPage).toContain(
      'This row is a buyer checklist, not a superiority claim'
    );
    expect(watiPage).not.toContain('WATIâ€™s');
  });

  it('uses current official WATI sources without lazy off-page instructions', () => {
    for (const source of [
      'https://www.wati.io/pricing/',
      'https://support.wati.io/en/articles/11462993-understanding-wati-s-pricing-structure',
      'https://support.wati.io/en/articles/11462997-understanding-wati-s-pricing-plans',
      'https://support.wati.io/en/collections/15525494-wati-plans-pricing',
    ]) {
      expect(watiPage).toContain(source);
    }

    expect(watiPage).toContain('July 19, 2026');
    expect(watiPage).toContain('does not claim one-to-one feature parity');
    expect(watiPage).not.toMatch(
      /read WATI docs|go to WATI|official documentation to learn/i
    );
    expect(watiPage).not.toMatch(
      /better than WATI|cheaper than WATI|all WATI features|guaranteed savings/i
    );
  });

  it('adds public navigation and footer discovery for completed commercial pages', () => {
    expect(publicHeader).toContain('const featureItems');
    expect(publicHeader).toContain('All Features');
    expect(publicHeader).toContain('Visual Flows');
    expect(publicHeader).toContain('const useCaseItems');
    expect(publicHeader).toContain('WhatsApp Sales');
    expect(publicHeader).toContain('WhatsApp Newsletter');
    expect(publicHeader).toContain('const comparisonItems');
    expect(publicHeader).toContain('WATI Alternative');
    expect(publicHeader).toContain('Use Cases');
    expect(publicHeader).toContain('Compare');
    expect(publicHeader).toContain('const desktopDropdowns');
    expect(publicHeader).toContain('const orderedDesktopNavItems');
    expect(publicHeader).toContain('const orderedMobileNavItems');
    expect(publicHeader).toMatch(
      /homeNavItem[\s\S]*desktopDropdowns\[0\][\s\S]*pricingNavItem[\s\S]*desktopDropdowns\[1\][\s\S]*desktopDropdowns\[2\]/
    );
    expect(publicHeader).toContain('openDesktopDropdown');
    expect(publicHeader).toContain('openMobileGroups');
    expect(publicHeader).toContain('aria-haspopup="menu"');
    expect(publicHeader).toContain('aria-expanded={isOpen}');
    expect(publicHeader).toContain('aria-controls={dropdownId}');
    expect(publicHeader).toContain('role="menu"');
    expect(publicHeader).toContain('role="menuitem"');
    expect(publicHeader).toContain('whitespace-nowrap');
    expect(publicHeader).not.toContain('onMouseEnter={() => setOpenDesktopDropdown');
    expect(publicHeader).toContain('xl:flex');
    expect(publicHeader).toContain('xl:hidden');
    expect(publicHeader).toContain('<a');
    expect(publicHeader).toContain('appHrefForHost("/signup", currentHost)');
    expect(publicHeader).not.toContain('{ label: "Flows", href: "/features/flows" },');
    expect(publicHeader).not.toContain('{ label: "Team Inbox", href: "/features/team-inbox" },\n  { label: "Automation"');
    expect(publicFooter).toContain('href === "/login" || href === "/signup"');
    expect(publicFooter).toContain('<a href={footerHref(href)}');
    expect(publicCtaButtons).toContain('primaryIsAuthHref');
    expect(publicCtaButtons).toContain('const PrimaryComponent = primaryIsAuthHref ? "a" : Link');
    expect(commercialPage).toContain('<a');
    expect(commercialPage).toContain('href="/signup"');
    expect(commercialPage).not.toContain('PublicCtaButtons');
    expect(commercialPage).not.toMatch(/<Link\s+href="\/signup"/);

    expect(publicFooter).toContain('heading: "Use Cases"');
    expect(publicFooter).toContain('WhatsApp Sales CRM');
    expect(publicFooter).toContain('WhatsApp Newsletter');
    expect(publicFooter).toContain('WATI Alternative');
    expect(publicFooter).toContain('Compare WATI Alternative');
  });
});
