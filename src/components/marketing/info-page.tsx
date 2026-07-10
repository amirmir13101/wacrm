import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";

interface InfoPageShellProps {
  readonly children: ReactNode;
}

interface InfoHeroProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly badges?: readonly string[];
  readonly breadcrumbs?: readonly {
    readonly label: string;
    readonly href: string;
  }[];
}

interface InfoSectionProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly tint?: "white" | "green";
}

interface InfoCardProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function InfoPageShell({ children }: InfoPageShellProps) {
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[#f6fbf8] text-[#07130e]">{children}</main>
      <PublicFooter />
    </>
  );
}

export function InfoHero({ eyebrow, title, description, badges = [], breadcrumbs = [] }: InfoHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0d1b15] px-5 pb-16 pt-9 text-white sm:px-8 sm:pb-16 sm:pt-12 lg:px-10 lg:py-20">
      <div className="absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(61,223,132,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(61,223,132,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-1/2 top-10 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#3ddf84]/20 blur-3xl" />
      <div className="mx-auto max-w-4xl text-center">
        {breadcrumbs.length ? (
          <nav aria-label="Breadcrumb" className="mb-6 flex justify-center">
            <ol className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b9f8df]">
              {breadcrumbs.map((item, index) => (
                <li key={item.href} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  <Link className="hover:text-white" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-[#ffbd29]">{eyebrow}</p>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#d8fff1] sm:text-lg">{description}</p>
        {badges.length ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#3ddf84]/35 bg-white/10 px-4 text-sm font-bold text-white"
              >
                <CheckCircle2 className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function InfoSection({ eyebrow, title, description, children, tint = "white" }: InfoSectionProps) {
  return (
    <section className={tint === "green" ? "bg-[#eefaf4] px-5 py-16 sm:px-8 lg:px-10" : "bg-white px-5 py-16 sm:px-8 lg:px-10"}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#08bba4]">{eyebrow}</p> : null}
          <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#07130e] sm:text-4xl">{title}</h2>
          {description ? <p className="mt-4 text-base leading-8 text-[#48675b]">{description}</p> : null}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export function InfoCard({ title, children }: InfoCardProps) {
  return (
    <article className="rounded-[22px] border border-[#dce9e2] bg-white p-6 shadow-[0_18px_45px_rgba(7,19,14,0.08)]">
      <h3 className="text-lg font-extrabold text-[#07130e]">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-[#48675b]">{children}</div>
    </article>
  );
}

export function InfoCardGrid({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function InfoCta() {
  return (
    <section className="bg-[#ffbd29] px-5 py-14 text-[#07130e] sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[28px] bg-white/35 p-6 ring-1 ring-[#07130e]/10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#0f5132]">Talk Wagon CRM</p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Ready to organize WhatsApp customer work?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#315345]">
            Start with a clean CRM workspace for conversations, contacts, broadcasts, automations, and team workflows.
          </p>
        </div>
        <Link
          href="/signup"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07130e] px-6 text-sm font-extrabold text-white hover:bg-[#1b372b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07130e]"
        >
          Start For Free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
