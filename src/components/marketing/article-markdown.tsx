import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownHeading {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

export function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractMarkdownHeadings(markdown: string): ReadonlyArray<MarkdownHeading> {
  return markdown
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^(##|###)\s+(.+?)\s*$/.exec(line);
      if (!match) return [];
      const text = match[2].replace(/[*_`~]/g, "").trim();
      const id = headingId(text);
      if (!id) return [];
      return [{ id, text, level: match[1] === "##" ? 2 : 3 } satisfies MarkdownHeading];
    });
}

function nodeText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(nodeText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return nodeText((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function Heading({ level, children }: { readonly level: 2 | 3; readonly children?: ReactNode }) {
  const id = headingId(nodeText(children));
  const className = level === 2
    ? "scroll-mt-28 text-3xl font-black tracking-[-0.035em] text-[#10231d] md:text-4xl"
    : "scroll-mt-28 text-2xl font-black tracking-[-0.025em] text-[#17382e]";
  if (level === 2) return <h2 id={id} className={className}>{children}</h2>;
  return <h3 id={id} className={className}>{children}</h3>;
}

function MarkdownLink({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="font-bold text-[#087d68] underline decoration-[#3bdc83]/50 underline-offset-4 hover:text-[#055f50]" {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-bold text-[#087d68] underline decoration-[#3bdc83]/50 underline-offset-4 hover:text-[#055f50]"
      {...props}
    >
      {children}
    </a>
  );
}

type ArticleMarkdownSegment =
  | { readonly type: "markdown"; readonly markdown: string }
  | { readonly type: "cta"; readonly cta: ArticleCtaBlockData };

interface ArticleCtaBlockData {
  readonly variant: "banner" | "card" | "feature" | "comparison" | "inline";
  readonly eyebrow?: string;
  readonly title: string;
  readonly body: string;
  readonly button?: string;
  readonly href?: string;
  readonly note?: string;
}

function parseCtaBlock(value: string): ArticleCtaBlockData | null {
  const fields = new Map<string, string>();
  for (const line of value.split(/\r?\n/)) {
    const match = /^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.+?)\s*$/.exec(line);
    if (match) fields.set(match[1].toLowerCase(), match[2]);
  }

  const title = fields.get("title");
  const body = fields.get("body");
  if (!title || !body) return null;

  const variant = fields.get("variant");
  const safeVariant = ["banner", "card", "feature", "comparison", "inline"].includes(variant ?? "")
    ? (variant as ArticleCtaBlockData["variant"])
    : "banner";

  return {
    variant: safeVariant,
    eyebrow: fields.get("eyebrow"),
    title,
    body,
    button: fields.get("button"),
    href: fields.get("href"),
    note: fields.get("note"),
  };
}

function splitArticleMarkdown(markdown: string): ReadonlyArray<ArticleMarkdownSegment> {
  const segments: ArticleMarkdownSegment[] = [];
  const pattern = /^:::tw-cta\s*\n([\s\S]*?)\n:::\s*$/gm;
  let cursor = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = markdown.slice(cursor, index).trim();
    if (before) segments.push({ type: "markdown", markdown: before });
    const cta = parseCtaBlock(match[1]);
    if (cta) segments.push({ type: "cta", cta });
    cursor = index + match[0].length;
  }

  const after = markdown.slice(cursor).trim();
  if (after) segments.push({ type: "markdown", markdown: after });
  return segments.length > 0 ? segments : [{ type: "markdown", markdown }];
}

function ArticleCtaBlock({ cta }: { readonly cta: ArticleCtaBlockData }) {
  const isCompact = cta.variant === "card" || cta.variant === "inline";
  const isComparison = cta.variant === "comparison";
  const href = cta.href?.startsWith("/") ? cta.href : undefined;

  return (
    <aside
      className={[
        "overflow-hidden rounded-[1.75rem] border shadow-sm",
        isComparison
          ? "border-[#ffbd29]/45 bg-[#fff8df]"
          : "border-[#3bdc83]/35 bg-[linear-gradient(135deg,#071b13,#12392c)] text-white",
        isCompact ? "p-5 md:p-6" : "p-6 md:p-8",
      ].join(" ")}
    >
      <div className={isCompact ? "space-y-4" : "grid gap-6 md:grid-cols-[1fr_auto] md:items-center"}>
        <div>
          {cta.eyebrow ? (
            <p className={isComparison ? "text-xs font-black uppercase tracking-[0.24em] text-[#9b6a00]" : "text-xs font-black uppercase tracking-[0.24em] text-[#ffbd29]"}>
              {cta.eyebrow}
            </p>
          ) : null}
          <h3 className={isComparison ? "mt-2 text-2xl font-black tracking-[-0.03em] text-[#10231d]" : "mt-2 text-2xl font-black tracking-[-0.03em] text-white"}>
            {cta.title}
          </h3>
          <p className={isComparison ? "mt-3 text-base leading-7 text-[#526960]" : "mt-3 text-base leading-7 text-[#d8fff1]"}>
            {cta.body}
          </p>
          {cta.note ? (
            <p className={isComparison ? "mt-3 text-sm font-bold text-[#7a5a0a]" : "mt-3 text-sm font-bold text-[#b8f6df]"}>
              {cta.note}
            </p>
          ) : null}
        </div>
        {href && cta.button ? (
          <Link
            href={href}
            className={[
              "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black transition",
              isComparison
                ? "bg-[#07130e] text-white hover:bg-[#3bdc83] hover:text-[#07130e]"
                : "bg-[#3bdc83] text-[#07130e] hover:bg-[#ffbd29]",
            ].join(" ")}
          >
            {cta.button}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

const markdownComponents: Components = {
  h1: ({ children }: { readonly children?: ReactNode }) => <h2 className="text-3xl font-black text-[#10231d]">{children}</h2>,
  h2: ({ children }: { readonly children?: ReactNode }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }: { readonly children?: ReactNode }) => <Heading level={3}>{children}</Heading>,
  p: ({ children }: { readonly children?: ReactNode }) => <p className="text-lg leading-8 text-[#526960]">{children}</p>,
  a: MarkdownLink,
  ul: ({ children }: { readonly children?: ReactNode }) => <ul className="space-y-3 pl-6 text-lg leading-8 text-[#526960] marker:text-[#087d68]">{children}</ul>,
  ol: ({ children }: { readonly children?: ReactNode }) => <ol className="space-y-3 pl-6 text-lg leading-8 text-[#526960] marker:font-black marker:text-[#087d68]">{children}</ol>,
  li: ({ children }: { readonly children?: ReactNode }) => <li className="pl-2">{children}</li>,
  blockquote: ({ children }: { readonly children?: ReactNode }) => (
    <blockquote className="rounded-[1.5rem] border border-[#3bdc83]/35 bg-[#effff6] px-6 py-5 text-lg font-semibold text-[#24463c]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-[#d7eee5]" />,
  table: ({ children }: { readonly children?: ReactNode }) => (
    <div className="overflow-x-auto rounded-2xl border border-[#d7eee5]">
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { readonly children?: ReactNode }) => <thead className="bg-[#0b2a20] text-white">{children}</thead>,
  th: ({ children }: { readonly children?: ReactNode }) => <th className="border-b border-[#d7eee5] px-4 py-3 font-black">{children}</th>,
  td: ({ children }: { readonly children?: ReactNode }) => <td className="border-b border-[#d7eee5] px-4 py-3 align-top text-[#526960]">{children}</td>,
  code: ({ children }: { readonly children?: ReactNode }) => <code className="rounded bg-[#e7f5ed] px-1.5 py-0.5 text-sm font-bold text-[#075d4e]">{children}</code>,
  pre: ({ children }: { readonly children?: ReactNode }) => <pre className="overflow-x-auto rounded-2xl bg-[#07130e] p-5 text-sm text-[#d6f7e8]">{children}</pre>,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
      loading="lazy"
      className="h-auto w-full rounded-[1.5rem] border border-[#d7eee5] bg-white object-cover shadow-sm"
    />
  ),
};

export function ArticleMarkdown({ markdown }: { readonly markdown: string }) {
  const segments = splitArticleMarkdown(markdown);

  return (
    <>
      {segments.map((segment, index) => (
        segment.type === "cta" ? (
          <ArticleCtaBlock key={`cta-${index}`} cta={segment.cta} />
        ) : (
          <ReactMarkdown key={`markdown-${index}`} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {segment.markdown}
          </ReactMarkdown>
        )
      ))}
    </>
  );
}
