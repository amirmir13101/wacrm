import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    heading: "Product",
    links: [
      ["Features", "/features"],
      ["Pricing", "/pricing"],
      ["Team Inbox", "/features#team-inbox"],
      ["Contacts", "/features#contacts"],
      ["Broadcasts", "/features#broadcasts"],
      ["Automation", "/features#automation"],
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
      ["WhatsApp Automation", "/features#automation"],
      ["AI CRM Automation", "/features#automation"],
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
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/hostiko-crm/brand/talk-wagon-logo.svg"
              alt="Talk Wagon CRM logo with a wagon and rocket"
              width={44}
              height={44}
              className="h-11 w-11"
            />
            <span className="text-lg font-extrabold text-white">Talk Wagon</span>
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
