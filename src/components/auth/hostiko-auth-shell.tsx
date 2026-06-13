import type { ReactNode } from "react";
import { CheckCircle2, MessageSquareText, Sparkles } from "lucide-react";

type HostikoAuthShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

const highlights = [
  "Shared WhatsApp team inbox",
  "Approved-template broadcasts",
  "Agent permissions and workspace security",
  "Automation workflows for customer follow-ups",
];

export function HostikoAuthShell({
  title,
  description,
  eyebrow = "Secure WhatsApp CRM access",
  children,
}: HostikoAuthShellProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07130e] text-white">
      <section className="relative px-5 py-10 sm:px-8 lg:py-14">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(61,223,132,0.24),transparent_52%)]" />
            <div className="absolute left-1/2 top-20 h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-[#315846] sm:h-[620px] sm:w-[620px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="hidden lg:block">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#315846] bg-[#10261c] px-4 py-2 text-sm text-[#b8e5d8]">
              <Sparkles className="h-4 w-4 text-[#ffbd29]" aria-hidden="true" />
              {eyebrow}
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-tight text-white xl:text-5xl">
              Secure access for your WhatsApp CRM workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#b8cfc7]">
              Sign in to manage customer conversations, team permissions, contact records,
              broadcasts, automation workflows, and follow-ups from one protected dashboard.
            </p>

            <div className="mt-8 grid gap-3">
              {highlights.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#315846] bg-[#10261c]/80 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                  <span className="text-sm text-[#d8fff1]">{item}</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="mx-auto w-full max-w-md rounded-[30px] border border-[#315846] bg-[#10261c]/95 p-4 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-5 rounded-[24px] border border-[#315846] bg-[#0d1b15] p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffbd29]">
                {eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#b8cfc7]">{description}</p>
            </div>
            {children}
          </section>
        </div>
      </section>
    </main>
  );
}
