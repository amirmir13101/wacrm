import type { Metadata } from "next";
import Link from "next/link";

import { InfoCard, InfoCardGrid, InfoCta, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/refund-policy");
const pageDescription =
  "Review the Talk Wagon refund policy for the 14-day free trial, monthly Pro plan, manual payment handling, third-party costs, and fair exception cases.";

export const metadata: Metadata = {
  title: "Refund Policy | Talk Wagon CRM",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon Refund Policy",
    description:
      "Refund rules for Talk Wagon CRM trials, monthly Pro subscriptions, setup requests, WhatsApp API costs, and fair exception cases.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Refund Policy | Talk Wagon CRM",
    description: pageDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RefundPolicyPage() {
  return (
    <>
      <WebPageJsonLd path="/refund-policy" name="Talk Wagon Refund Policy" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Refund Policy", url: "/refund-policy" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Refund Policy"
        title="Refund Rules for Talk Wagon CRM Plans and Setup"
        description="This policy explains how refunds are handled for Talk Wagon trials, the monthly Pro plan, manual payment review, setup requests, and related CRM service usage."
        badges={["14-day free trial", "Monthly Pro plan", "Fair exceptions", "WhatsApp costs separate"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Refund Policy", href: "/refund-policy" },
        ]}
      />

      <InfoSection
        title="Start With the 14-Day Free Trial"
        description="Talk Wagon is designed so customers can evaluate the CRM workflow before committing to paid use."
      >
        <div className="rounded-[26px] border border-[#3ddf84]/35 bg-[#f4fff9] p-6 text-base leading-8 text-[#315345] shadow-[0_18px_45px_rgba(7,19,14,0.08)]">
          <p className="font-semibold text-[#07130e]">
            Customers should use the 14-day free trial to test whether Talk Wagon fits their WhatsApp CRM workflow before
            upgrading or requesting a paid setup.
          </p>
          <p className="mt-4">
            Talk Wagon currently presents a monthly Pro plan on the public pricing page. Yearly billing is not offered
            on the public pricing page for now. After the trial period, active monthly subscription usage, completed setup
            work, or configured self-hosted delivery is generally non-refundable unless a fair exception applies.
          </p>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="General refund approach"
        title="When Refunds Are Generally Not Available"
        tint="green"
      >
        <InfoCardGrid>
          <InfoCard title="After active usage">
            Monthly Pro plan usage after the trial period is generally non-refundable once CRM access, workspace features,
            broadcasts, automations, or team workflows have been actively used.
          </InfoCard>
          <InfoCard title="After setup delivery">
            Lifetime, branded, or self-hosted setup payments are generally non-refundable once setup work has started,
            deployment work has been performed, or access has been delivered.
          </InfoCard>
          <InfoCard title="Third-party charges">
            WhatsApp, Meta, hosting, payment processor, domain, SSL, or other third-party charges are not refundable by
            Talk Wagon unless explicitly stated in a written agreement.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection title="Fair Exceptions We Can Review">
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="Duplicate charge">
            If you were accidentally charged twice for the same plan or setup, we can review and correct the duplicate
            billing issue.
          </InfoCard>
          <InfoCard title="Service not provisioned">
            If a paid service was not provisioned or access was not delivered, we can review the case and determine a fair
            correction.
          </InfoCard>
          <InfoCard title="Billing error">
            If there is a clear billing mistake, contact us with the account and transaction details so the issue can be
            reviewed.
          </InfoCard>
          <InfoCard title="Manual payment review">
            If you paid manually, include your workspace email, payment date, plan requested, and proof reference so the
            team can review the request without asking for private credentials.
          </InfoCard>
          <InfoCard title="Required by law">
            If applicable law requires a refund in your situation, Talk Wagon will review and handle the request
            accordingly.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="How to request review"
        title="Refund Review Process"
        description="If you believe a fair exception applies, contact Talk Wagon with your account details, plan or setup type, payment date, and a short explanation of the issue."
        tint="green"
      >
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            Please do not include passwords, API keys, WhatsApp access tokens, app secrets, private keys, or other
            sensitive credentials in your refund request. Use the{" "}
            <Link href="/contact" className="font-bold text-[#08bba4] hover:text-[#07130e]">
              Contact page
            </Link>{" "}
            to start a review.
          </p>
        </div>
      </InfoSection>

      <InfoCta />
      </InfoPageShell>
    </>
  );
}
