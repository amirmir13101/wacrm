import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const blogData = readSource('src/lib/marketing/blog.ts');
const blogIndex = readSource('src/app/blog/page.tsx');
const articlePage = readSource(
  'src/app/blog/whatsapp-business-greeting-message-examples/page.tsx'
);
const publicHeader = readSource('src/components/marketing/public-header.tsx');
const publicFooter = readSource('src/components/marketing/public-footer.tsx');
const tawkWidget = readSource('src/components/marketing/tawk-to-widget.tsx');
const sitemap = readSource('src/app/sitemap.ts');

describe('Article 01 WhatsApp Business greeting message guide', () => {
  it('creates only the approved blog index and Article 01 route metadata', () => {
    expect(blogData).toContain('whatsapp-business-greeting-message-examples');
    expect(blogData).toContain('whatsapp business greeting message');
    expect(blogData).toContain('database: "in"');
    expect(blogData).toContain('volume: 140');
    expect(blogData).toContain('kd: 14');

    expect(blogIndex).toContain('Practical WhatsApp CRM guides');
    expect(articlePage).toContain(
      'WhatsApp Business Greeting Messages: Examples and Setup Guide'
    );
    expect(articlePage).toContain('const canonicalUrl = article.canonicalUrl');
    expect(articlePage).toContain('type: "article"');
    expect(articlePage).toContain('robots:');
    expect(articlePage.match(/<h1/g)).toHaveLength(1);
  });

  it('uses source-backed content, visible FAQs, and matching schema only', () => {
    expect(articlePage).toContain('<FaqJsonLd id="article-01-faq-json-ld"');
    expect(articlePage).toContain('"@type": "BlogPosting"');
    expect(articlePage).toContain('"@type": "Organization"');
    expect(articlePage).toContain('WhatsApp Help Center: greeting messages');
    expect(articlePage).toContain('Meta for Developers: WhatsApp templates overview');
    expect(articlePage).not.toContain('Google Search Central: Creating helpful');
    expect(articlePage).toContain('Greeting message vs away message');

    for (const question of [
      'What is a WhatsApp Business greeting message?',
      'Is a greeting message the same as an away message?',
      'What should a greeting message include?',
      'Can a greeting message include a sales offer?',
      'Do WhatsApp Business greeting messages need Meta approval?',
    ]) {
      expect(articlePage).toContain(question);
    }

    expect(articlePage).not.toMatch(/guaranteed rankings|guaranteed conversions|official Meta partner/i);
    expect(articlePage).not.toMatch(/every example is pre-approved|controls Meta/i);
  });

  it('keeps keyword research and market data out of reader-facing article copy', () => {
    expect(articlePage).toContain('/features/team-inbox');
    expect(articlePage).toContain('/features/automation');
    expect(articlePage).toContain('/features/flows');
    expect(articlePage).toContain('/use-cases/sales');
    expect(blogIndex).toContain('<span>Guide</span>');
    expect(blogIndex).not.toContain('<span>{article.market}</span>');
    expect(articlePage).not.toContain('India keyword');
    expect(articlePage).not.toContain('Semrush');
    expect(articlePage).not.toContain('keyword:');
    expect(articlePage).not.toContain('content-gap analysis');
    expect(articlePage).not.toContain('Competitor pages were reviewed');
    expect(articlePage).not.toContain('WhatsApp CRM vs traditional CRM');
    expect(articlePage).not.toContain('WATI alternative');
    expect(articlePage).not.toContain('WhatsApp API pricing explained');
  });

  it('adds four optimized original article images distributed through the page', () => {
    const imagePaths = [
      'public/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-greeting-message-hero.webp',
      'public/hostiko-crm/generated/blog/talk-wagon-whatsapp-greeting-workflow.webp',
      'public/hostiko-crm/generated/blog/talk-wagon-business-message-examples.webp',
      'public/hostiko-crm/generated/blog/talk-wagon-team-inbox-human-handoff.webp',
    ];
    for (const path of imagePaths) {
      const imagePath = join(process.cwd(), path);
      expect(existsSync(imagePath)).toBe(true);
      expect(statSync(imagePath).size).toBeLessThan(260 * 1024);
    }
    expect(blogData).toContain(imagePaths[0].replace('public', ''));
    for (const path of imagePaths.slice(1)) {
      expect(articlePage).toContain(path.replace('public', ''));
    }
    expect(articlePage.match(/<EditorialImage/g)).toHaveLength(4);
    expect(blogData).toContain(
      '/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-greeting-message-hero.webp'
    );
    expect(blogData).toContain('greeting message workflow');
  });

  it('adds blog discovery to navigation, footer, sitemap, and Talk2 public paths', () => {
    expect(publicHeader).toContain('const blogNavItem = { label: "Blog", href: "/blog" } as const;');
    expect(publicHeader).toContain('{ type: "link", item: blogNavItem }');
    expect(publicHeader).toContain('(active === "blog" && item.href === "/blog")');
    expect(publicHeader).not.toContain('const resourceItems');
    expect(publicHeader).not.toContain('Greeting Message Guide');
    expect(publicHeader).not.toContain('Resources');
    expect(publicHeader).not.toContain('"resources"');
    expect(blogIndex).toContain('blogArticles.map');
    expect(blogIndex).toContain('article.image.src');
    expect(blogIndex).toContain('article.title');
    expect(blogIndex).toContain('article.excerpt');
    expect(blogIndex).toContain('article.readingTime');
    expect(blogIndex).toContain('Read guide');
    expect(publicFooter).toContain('WhatsApp Greeting Messages');
    expect(tawkWidget).toContain("'/blog'");
    expect(tawkWidget).toContain("'/blog/'");
    expect(sitemap).toContain('`${siteUrl}/blog`');
    expect(sitemap).toContain(
      '`${siteUrl}/blog/whatsapp-business-greeting-message-examples`'
    );
  });
});
