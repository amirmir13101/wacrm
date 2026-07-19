import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { HeroBadgeRow } from '@/components/marketing/hero-badge-row';
import { PublicCtaButtons } from '@/components/marketing/public-cta-buttons';
import { PublicFooter } from '@/components/marketing/public-footer';
import { PublicHeader } from '@/components/marketing/public-header';
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  WebPageJsonLd,
} from '@/components/marketing/seo-json-ld';

export type CommercialLandingCard = {
  readonly title: string;
  readonly description: string;
};

export type CommercialLandingStep = {
  readonly title: string;
  readonly description: string;
};

export type CommercialLandingSection = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
};

export type CommercialLandingFaq = {
  readonly question: string;
  readonly answer: string;
};

export type CommercialLandingLink = {
  readonly label: string;
  readonly href: string;
  readonly description: string;
};

export type CommercialLandingSource = {
  readonly label: string;
  readonly href: string;
  readonly description: string;
};

type CommercialLandingPageProps = {
  readonly path: string;
  readonly breadcrumbLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly trustItems: readonly string[];
  readonly outcomesEyebrow: string;
  readonly outcomesTitle: string;
  readonly outcomesDescription: string;
  readonly outcomes: readonly CommercialLandingCard[];
  readonly processEyebrow: string;
  readonly processTitle: string;
  readonly processDescription: string;
  readonly steps: readonly CommercialLandingStep[];
  readonly sections: readonly CommercialLandingSection[];
  readonly notice: {
    readonly title: string;
    readonly description: string;
  };
  readonly sources?: readonly CommercialLandingSource[];
  readonly relatedLinks: readonly CommercialLandingLink[];
  readonly faqs: readonly CommercialLandingFaq[];
  readonly faqTitle: string;
  readonly ctaTitle: string;
  readonly ctaDescription: string;
};

export function CommercialLandingPage({
  path,
  breadcrumbLabel,
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  trustItems,
  outcomesEyebrow,
  outcomesTitle,
  outcomesDescription,
  outcomes,
  processEyebrow,
  processTitle,
  processDescription,
  steps,
  sections,
  notice,
  sources,
  relatedLinks,
  faqs,
  faqTitle,
  ctaTitle,
  ctaDescription,
}: CommercialLandingPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbf8] text-[#07130e]">
      <WebPageJsonLd path={path} name={title} description={description} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: breadcrumbLabel, url: path },
        ]}
      />
      <FaqJsonLd
        id={`faq-json-ld-${breadcrumbLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        faqs={faqs}
      />

      <PublicHeader />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.96),rgba(27,55,43,0.82),rgba(7,19,14,0.96))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-25" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pt-9 pb-16 sm:px-8 sm:pt-12 sm:pb-16 lg:min-h-[670px] lg:grid-cols-[0.94fr_1.06fr] lg:px-10 lg:py-20">
          <div className="text-center lg:text-left">
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold tracking-[0.16em] text-[#b9f8df] uppercase lg:justify-start">
                <li>
                  <Link className="hover:text-white" href="/">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link className="text-white" href={path}>
                    {breadcrumbLabel}
                  </Link>
                </li>
              </ol>
            </nav>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <Sparkles className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 className="text-4xl leading-tight font-extrabold text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              {description}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3ddf84] px-7 text-sm font-bold text-[#07130e] hover:bg-[#ffbd29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start Free Trial
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-sm font-bold text-white hover:bg-white hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                View Pricing
              </Link>
            </div>
            <HeroBadgeRow items={trustItems} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={image}
              alt={imageAlt}
              width={1168}
              height={880}
              priority
              className="h-auto w-full rounded-[26px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-[#08bba4] uppercase">
              {outcomesEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              {outcomesTitle}
            </h2>
            <p className="mt-4 text-base leading-8 text-[#5b7169]">
              {outcomesDescription}
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {outcomes.map((outcome) => (
              <article
                key={outcome.title}
                className="rounded-[26px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]"
              >
                <CheckCircle2
                  className="h-7 w-7 text-[#08bba4]"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-xl font-extrabold text-[#07130e]">
                  {outcome.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  {outcome.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-[#3ddf84] uppercase">
              {processEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              {processTitle}
            </h2>
            <p className="mt-4 text-base leading-8 text-[#d5e9e2]">
              {processDescription}
            </p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[26px] bg-[#0d1b15] p-6 ring-1 ring-white/10"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#3ddf84] text-sm font-extrabold text-[#07130e]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-extrabold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#b8cfc7]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-[30px] bg-white p-7 ring-1 ring-[#dbe9e2]"
            >
              <p className="text-xs font-bold tracking-[0.14em] text-[#08bba4] uppercase">
                {section.eyebrow}
              </p>
              <h2 className="mt-4 text-2xl font-extrabold text-[#07130e]">
                {section.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#5b7169]">
                {section.description}
              </p>
              <ul className="mt-6 space-y-4">
                {section.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-sm leading-7 text-[#40574e]"
                  >
                    <CheckCircle2
                      className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-[30px] bg-[#f4fff9] p-7 ring-1 ring-[#bfe8d3] sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0d1b15] text-[#3ddf84]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold text-[#07130e]">
                {notice.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#40574e]">
                {notice.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {sources?.length ? (
        <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-sm font-bold text-[#08bba4] uppercase">
                Evidence reviewed
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
                Official Sources Used for This Comparison
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#5b7169]">
                Reviewed on July 18, 2026. Third-party plans and documentation
                can change, so verify current details before deciding.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {sources.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[26px] bg-white p-6 ring-1 ring-[#dbe9e2] transition hover:ring-[#3ddf84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                >
                  <span className="inline-flex items-center gap-2 font-extrabold text-[#08745d]">
                    {source.label}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="mt-3 block text-sm leading-7 text-[#5b7169]">
                    {source.description}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-[#08bba4] uppercase">
              Explore Talk Wagon
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Continue Your Product Evaluation
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {relatedLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[26px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2] transition hover:ring-[#3ddf84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
              >
                <h3 className="text-lg font-extrabold text-[#07130e]">
                  {item.label}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  {item.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] group-hover:text-[#07130e]">
                  Learn more
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-[#08bba4] uppercase">FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              {faqTitle}
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[26px] bg-white p-6 ring-1 ring-[#dbe9e2]"
              >
                <h3 className="text-lg font-extrabold text-[#07130e]">
                  {faq.question}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ffbd29] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center lg:flex-row lg:text-left">
          <div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              {ctaTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#28433a]">
              {ctaDescription}
            </p>
          </div>
          <PublicCtaButtons
            primaryLabel="Start Free Trial"
            primaryHref="/signup"
            secondaryLabel="View Pricing"
            secondaryHref="/pricing"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
