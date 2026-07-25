"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { appHrefForHost, marketingHrefForHost } from "@/lib/domain-routing";
import { comparisonLinks } from "@/lib/marketing/comparison-links";

const footerGroups = [
  {
    heading: "Product",
    links: [
      ["Features", "/features"],
      ["Flows", "/features/flows"],
      ["Team Inbox", "/features/team-inbox"],
      ["Contacts", "/features#contact-management"],
      ["Broadcasts", "/features/broadcasts"],
      ["Automation", "/features/automation"],
      ["Pipeline", "/features#sales-pipeline"],
    ],
  },
  {
    heading: "Company",
    links: [
      ["About Us", "/about"],
      ["Pricing", "/pricing"],
      ["FAQ", "/features#faq"],
      ["Contact Us", "/contact"],
    ],
  },
  {
    heading: "Use Cases",
    links: [
      ["WhatsApp Sales CRM", "/use-cases/sales"],
      ["WhatsApp Newsletter", "/use-cases/newsletter"],
      ...comparisonLinks.map(({ label, href }) => [label, href] as const),
    ],
  },
  {
    heading: "Resources",
    links: [
      ["Blog", "/blog"],
      ["WhatsApp Greeting Messages", "/blog/whatsapp-business-greeting-message-examples"],
      ["WhatsApp CRM", "/"],
      ["WhatsApp API Prices", "/whatsapp-api-prices"],
      ["WhatsApp Flows", "/features/flows"],
      ["WhatsApp Automation", "/features/automation"],
      ["Meta Template Approval", "/features/flows#meta-template-submission"],
      ["AI CRM Automation", "/features/automation"],
      ["Sales CRM", "/features#sales-pipeline"],
      ["WhatsApp Broadcast CRM", "/features/broadcasts"],
      ...comparisonLinks.map(({ label, href }) => [`Compare ${label}`, href] as const),
    ],
  },
  {
    heading: "Account",
    links: [
      ["Login", "/login"],
      ["Start For Free", "/signup"],
    ],
  },
  {
    heading: "Legal",
    links: [
      ["Privacy Policy", "/privacy-policy"],
      ["Terms of Service", "/terms-and-conditions"],
      ["Refund Policy", "/refund-policy"],
      ["Data Deletion", "/data-deletion"],
      ["Security", "/security"],
    ],
  },
] as const;

export function PublicFooter() {
  const [currentHost, setCurrentHost] = useState("");

  useEffect(() => {
    setCurrentHost(window.location.hostname);
  }, []);

  function footerHref(href: string): string {
    return href === "/login" || href === "/signup"
      ? appHrefForHost(href, currentHost)
      : marketingHrefForHost(href, currentHost);
  }

  return (
    <footer id="footer" className="bg-[#0d1b15] px-5 py-16 text-white sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-10 text-center md:grid-cols-2 lg:grid-cols-[minmax(280px,1.25fr)_repeat(6,minmax(0,1fr))] lg:text-left">
        <div className="md:col-span-2 lg:col-span-1">
          <Link
            href={marketingHrefForHost("/", currentHost)}
            className="mx-auto inline-flex max-w-full rounded-[18px] border border-[#3ddf84]/35 bg-[#f4fff9] px-3 py-2 shadow-[0_18px_54px_rgba(0,0,0,0.22)] ring-1 ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3ddf84] lg:mx-0"
            aria-label="Talk Wagon home"
          >
            <Image
              src="/hostiko-crm/brand/talk-wagon-logo-public.webp"
              alt="Talk Wagon CRM logo"
              width={520}
              height={79}
              className="h-7 w-auto max-w-[180px] object-contain sm:h-8 sm:max-w-[210px]"
            />
          </Link>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[#7fb9a9] lg:mx-0">
            Copyright 2026 Talk Wagon. Secure customer communication for WhatsApp teams.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.heading}>
            <h3 className="font-extrabold text-white">{group.heading}</h3>
            <ul className="mt-4 space-y-2 text-sm text-[#7fb9a9] sm:space-y-3">
              {group.links.map(([label, href]) => (
                <li key={label}>
                  {href === "/login" || href === "/signup" ? (
                    <a href={footerHref(href)} className="inline-flex min-h-9 items-center justify-center hover:text-[#3ddf84] lg:min-h-0 lg:justify-start">
                      {label}
                    </a>
                  ) : href ? (
                    <Link href={footerHref(href)} className="inline-flex min-h-9 items-center justify-center hover:text-[#3ddf84] lg:min-h-0 lg:justify-start">
                      {label}
                    </Link>
                  ) : (
                    <span className="text-[#7fb9a9]/75">{label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
