"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Code2, Edit3, Eye, FileClock, FilePlus2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlogCmsSummary, ManagedBlogArticle } from "@/lib/marketing/blog-cms";
import { cn } from "@/lib/utils";

interface CodeManagedArticle {
  readonly slug: string;
  readonly title: string;
  readonly path: string;
  readonly publishedDate: string;
  readonly updatedDate: string;
}

interface ArticlesPayload {
  readonly articles?: ReadonlyArray<ManagedBlogArticle>;
  readonly summary?: BlogCmsSummary;
  readonly codeManagedArticles?: ReadonlyArray<CodeManagedArticle>;
  readonly error?: string;
  readonly migrationRequired?: boolean;
}

type Filter = "all" | "draft" | "published";

export function ArticleManager() {
  const [payload, setPayload] = useState<ArticlesPayload>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/articles", { cache: "no-store" });
      const body = await response.json() as ArticlesPayload;
      setPayload(body);
      if (!response.ok && !body.migrationRequired) throw new Error(body.error ?? "Failed to load articles.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load articles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const articles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (payload.articles ?? []).filter((article) => {
      if (filter !== "all" && article.status !== filter) return false;
      if (!normalizedQuery) return true;
      return [article.title, article.slug, article.primaryKeyword ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, payload.articles, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-300">Publishing workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Articles & blog posts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Create editorial drafts, review the exact public layout, and publish approved articles without a new code deployment.
          </p>
        </div>
        <Link href="/admin/articles/new" className={cn(buttonVariants(), "bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400")}><FilePlus2 className="mr-2 h-4 w-4" />New article</Link>
      </div>

      {payload.migrationRequired ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-5 text-sm text-amber-100">
          <p className="font-bold">One database step is required.</p>
          <p className="mt-1 text-amber-100/80">Apply <code>061_blog_article_management.sql</code> to enable drafts and publishing. Existing public articles remain unaffected.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="All articles" value={payload.summary?.total ?? 0} icon={BookOpen} tone="emerald" />
        <MetricCard label="Published" value={(payload.summary?.codeManaged ?? 0) + (payload.summary?.managedPublished ?? 0)} icon={Eye} tone="cyan" />
        <MetricCard label="Drafts" value={payload.summary?.drafts ?? 0} icon={FileClock} tone="amber" />
        <MetricCard label="Code managed" value={payload.summary?.codeManaged ?? 0} icon={Code2} tone="violet" />
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">Managed articles</CardTitle>
            <p className="mt-1 text-sm text-slate-400">Editable drafts and published posts created through this dashboard.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-400 sm:w-56" />
            </label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400">
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading articles...</div>
          ) : payload.migrationRequired ? (
            <div className="p-8 text-sm text-slate-400">Managed articles will appear after the migration is applied.</div>
          ) : articles.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 font-semibold text-white">No managed articles in this view</p>
              <p className="mt-1 text-sm text-slate-400">Create a draft to begin the editorial workflow.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {articles.map((article) => (
                <div key={article.id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-800/35 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-white">{article.title}</h2>
                      <StatusBadge status={article.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-400">/blog/{article.slug}</p>
                    <p className="mt-2 text-xs text-slate-500">Updated {new Date(article.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/article-preview/${article.id}`} target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white")}><Eye className="mr-2 h-4 w-4" />Preview</Link>
                    <Link href={`/admin/articles/${article.id}`} className={cn(buttonVariants({ size: "sm" }), "bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400")}><Edit3 className="mr-2 h-4 w-4" />Edit</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Code2 className="h-5 w-5 text-violet-300" />Existing published articles</CardTitle>
          <p className="text-sm leading-6 text-slate-400">These established SEO articles remain code-managed to preserve their custom layouts. They are included in article totals and can be previewed here.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(payload.codeManagedArticles ?? []).map((article, index) => (
            <div key={article.slug} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-emerald-400/45">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-400/60 bg-amber-400/10 text-xs font-black text-amber-300">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{article.title}</p>
                  <p className="mt-1 text-xs text-slate-500">Published {article.publishedDate}</p>
                  <Link href={article.path} target="_blank" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200"><Eye className="h-4 w-4" />Open article</Link>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { readonly status: ManagedBlogArticle["status"] }) {
  return status === "published"
    ? <Badge className="border border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Published</Badge>
    : <Badge className="border border-amber-400/30 bg-amber-400/10 text-amber-200">Draft</Badge>;
}

function MetricCard({ label, value, icon: Icon, tone }: { readonly label: string; readonly value: number; readonly icon: typeof BookOpen; readonly tone: "emerald" | "cyan" | "amber" | "violet" }) {
  const tones = {
    emerald: "bg-emerald-400/10 text-emerald-300",
    cyan: "bg-cyan-400/10 text-cyan-300",
    amber: "bg-amber-400/10 text-amber-300",
    violet: "bg-violet-400/10 text-violet-300",
  } as const;
  return (
    <Card className="border-slate-800 bg-slate-900 transition hover:border-emerald-400/45">
      <CardContent className="flex items-center gap-4 pt-6">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <div><p className="text-2xl font-black text-white">{value}</p><p className="text-sm text-slate-400">{label}</p></div>
      </CardContent>
    </Card>
  );
}
