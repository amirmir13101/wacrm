import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    heading: "Product",
    links: [
      ["Features", "/features"],
      ["Pricing", "/pricing"],
      ["Team Inbox", "/features/team-inbox"],
      ["Automation", "/features/automation"],
      ["Broadcasts", "/features/broadcasts"],
      ["Contacts", "/features#contacts"],
      ["Pipeline", "/features#pipeline"],
    ],
  },
  {
    heading: "Company",
    links: [
      ["About", "/features#overview"],
      ["Pricing", "/pricing"],
      ["FAQ", "/features#faq"],
      ["Contact", "#footer"],
    ],
  },
  {
    heading: "Resources",
    links: [
      ["WhatsApp CRM", "/features"],
      ["WhatsApp Automation", "/features/automation"],
      ["AI CRM Automation", "/features/automation"],
      ["WhatsApp Broadcasts", "/features/broadcasts"],
      ["Sales CRM", "/features#pipeline"],
    ],
  },
  {
    heading: "Account",
    links: [
      ["Login", "/login"],
      ["Start For Free", "/signup"],
      ["Password Help", "/forgot-password"],
    ],
  },
  {
    heading: "Legal",
    links: [
      ["Privacy Policy", "#footer"],
      ["Terms of Service", "#footer"],
      ["Security", "/features#permissions"],
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer id="footer" className="bg-[#0d1b15] px-5 py-16 text-white sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <Link
            href="/"
            className="inline-flex rounded-[24px] border border-[#3ddf84]/35 bg-[#f4fff9] px-5 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.26)] ring-1 ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3ddf84]"
            aria-label="Talk Wagon home"
          >
            <Image
              src="/hostiko-crm/brand/talk-wagon-logo-public.webp"
              alt="Talk Wagon CRM logo"
              width={520}
              height={79}
              className="h-10 w-auto max-w-[250px] object-contain sm:h-12 sm:max-w-[310px]"
            />
          </Link>
          <p className="mt-4 text-sm leading-7 text-[#7fb9a9]">
            Copyright 2026 Talk Wagon. Secure customer communication for WhatsApp teams.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.heading}>
            <h3 className="font-extrabold text-white">{group.heading}</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#7fb9a9]">
              {group.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-[#3ddf84]">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
