"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileCheck2, Loader2, Plus, Save, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ArticleMarkdown } from "@/components/marketing/article-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ManagedBlogArticle, ManagedBlogFaq, ManagedBlogStatus } from "@/lib/marketing/blog-cms";
import { cn } from "@/lib/utils";

interface EditorArticle {
  readonly id?: string;
  readonly slug: string;
  readonly status: ManagedBlogStatus;
  readonly title: string;
  readonly seoTitle: string;
  readonly description: string;
  readonly excerpt: string;
  readonly contentMarkdown: string;
  readonly category: string;
  readonly author: string;
  readonly readingTime: string;
  readonly primaryKeyword: string;
  readonly secondaryKeywords: string;
  readonly heroImageUrl: string;
  readonly heroImageAlt: string;
  readonly heroImageWidth: number;
  readonly heroImageHeight: number;
  readonly faqs: ReadonlyArray<ManagedBlogFaq>;
}

const EMPTY_ARTICLE: EditorArticle = {
  slug: "",
  status: "draft",
  title: "",
  seoTitle: "",
  description: "",
  excerpt: "",
  contentMarkdown: "## Introduction\n\nStart writing your article here.\n\n## Main section\n\nAdd useful, source-backed information for readers.",
  category: "Guide",
  author: "TalkWagon Editorial Team",
  readingTime: "8 min read",
  primaryKeyword: "",
  secondaryKeywords: "",
  heroImageUrl: "",
  heroImageAlt: "",
  heroImageWidth: 1600,
  heroImageHeight: 900,
  faqs: [],
};

function fromManaged(article: ManagedBlogArticle): EditorArticle {
  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    title: article.title,
    seoTitle: article.seoTitle,
    description: article.description,
    excerpt: article.excerpt,
    contentMarkdown: article.contentMarkdown,
    category: article.category,
    author: article.author,
    readingTime: article.readingTime,
    primaryKeyword: article.primaryKeyword ?? "",
    secondaryKeywords: article.secondaryKeywords.join(", "),
    heroImageUrl: article.heroImageUrl ?? "",
    heroImageAlt: article.heroImageAlt ?? "",
    heroImageWidth: article.heroImageWidth,
    heroImageHeight: article.heroImageHeight,
    faqs: article.faqs,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function ArticleEditor({ articleId }: { readonly articleId?: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<EditorArticle>(EMPTY_ARTICLE);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "seo" | "faqs" | "preview">("content");
  const [slugTouched, setSlugTouched] = useState(Boolean(articleId));

  useEffect(() => {
    if (!articleId) return;
    async function load() {
      try {
        const response = await fetch(`/api/admin/articles/${articleId}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load article.");
        setArticle(fromManaged(payload.article as ManagedBlogArticle));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load article.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [articleId]);

  const characterCount = article.contentMarkdown.length;
  const estimatedWords = useMemo(() => article.contentMarkdown.trim().split(/\s+/).filter(Boolean).length, [article.contentMarkdown]);

  function update<K extends keyof EditorArticle>(key: K, value: EditorArticle[K]) {
    setArticle((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(value: string) {
    setArticle((current) => ({
      ...current,
      title: value,
      seoTitle: current.seoTitle || value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  async function save(status: ManagedBlogStatus) {
    setSaving(true);
    try {
      const response = await fetch(articleId ? `/api/admin/articles/${articleId}` : "/api/admin/articles", {
        method: articleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...article, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save article.");
      toast.success(status === "published" ? "Article published." : "Draft saved.");
      if (!articleId && payload.article?.id) {
        router.replace(`/admin/articles/${payload.article.id}`);
      } else {
        setArticle((current) => ({ ...current, status }));
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save article.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDraft() {
    if (!articleId || article.status !== "draft") return;
    if (!window.confirm("Delete this draft permanently?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to delete draft.");
      toast.success("Draft deleted.");
      router.replace("/admin/articles");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete draft.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading editor...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin/articles" aria-label="Back to articles" className={cn(buttonVariants({ size: "icon", variant: "outline" }), "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white")}><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <p className="text-sm font-semibold text-emerald-300">{articleId ? "Edit article" : "New article"}</p>
            <h1 className="mt-1 text-2xl font-bold text-white">{article.title || "Untitled article"}</h1>
            <p className="mt-1 text-xs text-slate-500">{estimatedWords.toLocaleString()} words · {characterCount.toLocaleString()} characters · {article.status}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {articleId ? <Link href={`/article-preview/${articleId}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }), "border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white")}><Eye className="mr-2 h-4 w-4" />Full preview</Link> : null}
          {articleId && article.status === "draft" ? <Button type="button" variant="outline" disabled={saving} onClick={() => void removeDraft()} className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"><Trash2 className="mr-2 h-4 w-4" />Delete draft</Button> : null}
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save("draft")} className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft</Button>
          <Button type="button" disabled={saving} onClick={() => void save("published")} className="bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{article.status === "published" ? "Update published" : "Publish article"}</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-2">
        {(["content", "seo", "faqs", "preview"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${activeTab === tab ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>{tab}</button>
        ))}
      </div>

      {activeTab === "content" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <Field label="Article title" hint={`${article.title.length}/180`}><input value={article.title} onChange={(event) => updateTitle(event.target.value)} className={inputClass} placeholder="A useful, specific article title" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="URL slug"><div className="flex rounded-lg border border-slate-700 bg-slate-950 focus-within:border-emerald-400"><span className="flex items-center pl-3 text-sm text-slate-500">/blog/</span><input value={article.slug} onChange={(event) => { setSlugTouched(true); update("slug", slugify(event.target.value)); }} className="h-11 min-w-0 flex-1 bg-transparent px-1 pr-3 text-sm text-white outline-none" /></div></Field>
              <Field label="Category"><input value={article.category} onChange={(event) => update("category", event.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Article summary" hint={`${article.excerpt.length}/500`}><textarea value={article.excerpt} onChange={(event) => update("excerpt", event.target.value)} className={`${textareaClass} min-h-24`} placeholder="A clear summary used in the hero and blog listing." /></Field>
            <Field label="Article body (Markdown)" hint="Use ## for table-of-contents sections"><textarea value={article.contentMarkdown} onChange={(event) => update("contentMarkdown", event.target.value)} className={`${textareaClass} min-h-[620px] font-mono text-[13px] leading-6`} spellCheck /></Field>
          </section>
          <aside className="space-y-5">
            <Panel title="Publishing details">
              <Field label="Author"><input value={article.author} onChange={(event) => update("author", event.target.value)} className={inputClass} /></Field>
              <Field label="Reading time"><input value={article.readingTime} onChange={(event) => update("readingTime", event.target.value)} className={inputClass} placeholder="8 min read" /></Field>
            </Panel>
            <Panel title="Hero image">
              <Field label="Image path or HTTPS URL"><input value={article.heroImageUrl} onChange={(event) => update("heroImageUrl", event.target.value)} className={inputClass} placeholder="/hostiko-crm/generated/blog/...webp" /></Field>
              <Field label="Descriptive alt text"><textarea value={article.heroImageAlt} onChange={(event) => update("heroImageAlt", event.target.value)} className={`${textareaClass} min-h-24`} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Width"><input type="number" value={article.heroImageWidth} onChange={(event) => update("heroImageWidth", Number(event.target.value))} className={inputClass} /></Field><Field label="Height"><input type="number" value={article.heroImageHeight} onChange={(event) => update("heroImageHeight", Number(event.target.value))} className={inputClass} /></Field></div>
            </Panel>
          </aside>
        </div>
      ) : null}

      {activeTab === "seo" ? (
        <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:grid-cols-2">
          <Field label="SEO title" hint={`${article.seoTitle.length}/180`}><input value={article.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} className={inputClass} /></Field>
          <Field label="Primary keyword"><input value={article.primaryKeyword} onChange={(event) => update("primaryKeyword", event.target.value)} className={inputClass} /></Field>
          <div className="lg:col-span-2"><Field label="Meta description" hint={`${article.description.length}/320`}><textarea value={article.description} onChange={(event) => update("description", event.target.value)} className={`${textareaClass} min-h-28`} /></Field></div>
          <div className="lg:col-span-2"><Field label="Supporting keywords" hint="Comma separated"><input value={article.secondaryKeywords} onChange={(event) => update("secondaryKeywords", event.target.value)} className={inputClass} /></Field></div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 lg:col-span-2">
            <p className="text-xs text-slate-500">Search preview</p>
            <p className="mt-3 text-xl text-[#8ab4f8]">{article.seoTitle || article.title || "Article title"}</p>
            <p className="mt-1 text-sm text-emerald-300">https://talkwagon.chat/blog/{article.slug || "article-slug"}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{article.description || "Your meta description will appear here."}</p>
          </div>
        </section>
      ) : null}

      {activeTab === "faqs" ? (
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold text-white">Article FAQs</h2><p className="mt-1 text-sm text-slate-400">Published FAQs appear visibly and in FAQPage structured data.</p></div><Button type="button" onClick={() => update("faqs", [...article.faqs, { question: "", answer: "" }])} className="bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"><Plus className="mr-2 h-4 w-4" />Add FAQ</Button></div>
          {article.faqs.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No FAQs added.</div> : article.faqs.map((faq, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1fr_1.4fr_auto]">
              <input value={faq.question} onChange={(event) => updateFaq(index, { ...faq, question: event.target.value }, article, setArticle)} className={inputClass} placeholder="Question" />
              <textarea value={faq.answer} onChange={(event) => updateFaq(index, { ...faq, answer: event.target.value }, article, setArticle)} className={`${textareaClass} min-h-20`} placeholder="Answer" />
              <Button type="button" size="icon" variant="outline" onClick={() => update("faqs", article.faqs.filter((_, faqIndex) => faqIndex !== index))} className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === "preview" ? (
        <section className="rounded-2xl border border-slate-800 bg-[#f8fffb] p-6 md:p-10">
          <div className="mb-8 border-b border-[#d7eee5] pb-6"><p className="text-sm font-black uppercase tracking-[0.2em] text-[#087d68]">Live content preview</p><h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#10231d]">{article.title || "Untitled article"}</h2><p className="mt-4 text-lg leading-8 text-[#526960]">{article.excerpt}</p></div>
          <div className="space-y-8"><ArticleMarkdown markdown={article.contentMarkdown} /></div>
        </section>
      ) : null}

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400"><FileCheck2 className="h-4 w-4 text-emerald-300" />Drafts stay private until you publish them.</div>
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void save("draft")} className="flex-1 border-slate-700 text-slate-200 hover:bg-slate-800 md:flex-none"><Save className="mr-2 h-4 w-4" />Save draft</Button><Button type="button" disabled={saving} onClick={() => void save("published")} className="flex-1 bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400 md:flex-none"><Send className="mr-2 h-4 w-4" />{article.status === "published" ? "Update" : "Publish"}</Button></div>
      </div>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400";
const textareaClass = "w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400";

function Field({ label, hint, children }: { readonly label: string; readonly hint?: string; readonly children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-200"><span>{label}</span>{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}</span>{children}</label>;
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">{title}</h2>{children}</section>;
}

function updateFaq(index: number, faq: ManagedBlogFaq, article: EditorArticle, setArticle: React.Dispatch<React.SetStateAction<EditorArticle>>) {
  setArticle({ ...article, faqs: article.faqs.map((item, itemIndex) => itemIndex === index ? faq : item) });
}
