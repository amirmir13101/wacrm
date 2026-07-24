import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
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

export function ArticleMarkdown({ markdown }: { readonly markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h2 className="text-3xl font-black text-[#10231d]">{children}</h2>,
        h2: ({ children }) => <Heading level={2}>{children}</Heading>,
        h3: ({ children }) => <Heading level={3}>{children}</Heading>,
        p: ({ children }) => <p className="text-lg leading-8 text-[#526960]">{children}</p>,
        a: MarkdownLink,
        ul: ({ children }) => <ul className="space-y-3 pl-6 text-lg leading-8 text-[#526960] marker:text-[#087d68]">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-3 pl-6 text-lg leading-8 text-[#526960] marker:font-black marker:text-[#087d68]">{children}</ol>,
        li: ({ children }) => <li className="pl-2">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="rounded-[1.5rem] border border-[#3bdc83]/35 bg-[#effff6] px-6 py-5 text-lg font-semibold text-[#24463c]">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-[#d7eee5]" />,
        table: ({ children }) => (
          <div className="overflow-x-auto rounded-2xl border border-[#d7eee5]">
            <table className="min-w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#0b2a20] text-white">{children}</thead>,
        th: ({ children }) => <th className="border-b border-[#d7eee5] px-4 py-3 font-black">{children}</th>,
        td: ({ children }) => <td className="border-b border-[#d7eee5] px-4 py-3 align-top text-[#526960]">{children}</td>,
        code: ({ children }) => <code className="rounded bg-[#e7f5ed] px-1.5 py-0.5 text-sm font-bold text-[#075d4e]">{children}</code>,
        pre: ({ children }) => <pre className="overflow-x-auto rounded-2xl bg-[#07130e] p-5 text-sm text-[#d6f7e8]">{children}</pre>,
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={typeof src === "string" ? src : ""}
            alt={alt ?? ""}
            loading="lazy"
            className="h-auto w-full rounded-[1.5rem] border border-[#d7eee5] bg-white object-cover shadow-sm"
          />
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
