import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "WhatsApp CRM for Teams",
  description:
    "A self-hosted WhatsApp CRM for shared inboxes, contacts, broadcasts, automations, and pipelines powered by the official Meta WhatsApp Cloud API.",
};

const features = [
  {
    title: "Shared Inbox",
    description:
      "Handle incoming WhatsApp conversations, reply quickly, and keep customer context in one place.",
    icon: MessageSquareText,
  },
  {
    title: "Contacts",
    description:
      "Store clean international WhatsApp numbers, tags, notes, and customer details for follow-up.",
    icon: Users,
  },
  {
    title: "Broadcasts",
    description:
      "Send approved Meta templates to opted-in audiences with queueing, retries, and delivery tracking.",
    icon: Radio,
  },
  {
    title: "Automations",
    description:
      "Trigger useful follow-ups from messages, tags, and customer activity without manual busywork.",
    icon: Bot,
  },
  {
    title: "Pipelines",
    description:
      "Track leads, deals, stages, and next actions from first chat to closed sale.",
    icon: GitBranch,
  },
  {
    title: "Reports",
    description:
      "Review conversations, contacts, broadcast results, deal value, and team activity from the dashboard.",
    icon: BarChart3,
  },
];

const workflow = [
  "Connect your official Meta WhatsApp Cloud API account.",
  "Import or add opted-in contacts with normalized phone numbers.",
  "Reply from the inbox or queue approved-template broadcasts safely.",
  "Track sent, delivered, read, replied, skipped, and failed recipients.",
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex min-h-[92vh] max-w-7xl flex-col px-6 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold tracking-normal">
                wacrm
              </span>
            </Link>

            <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
              <a href="#features" className="hover:text-white">
                Features
              </a>
              <a href="#plans" className="hover:text-white">
                Plans
              </a>
              <a href="#contact" className="hover:text-white">
                Contact
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="h-9 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="h-9 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                  Get Started
                </Button>
              </Link>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.92fr] lg:py-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Built for the official Meta WhatsApp Cloud API
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
                WhatsApp CRM for sales, support, and safe bulk messaging
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Manage WhatsApp conversations, contacts, pipelines, broadcasts,
                and automations from one self-hosted CRM. Keep customer data in
                Supabase and send production campaigns through approved Meta
                templates.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button className="h-11 w-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400 sm:w-auto">
                    Register / Get Started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="h-11 w-full border-slate-600 bg-slate-950/30 px-5 text-slate-100 hover:bg-slate-800 hover:text-white sm:w-auto"
                  >
                    Login
                  </Button>
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-2">
                {workflow.map((item) => (
                  <div key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    Live CRM Snapshot
                  </p>
                  <p className="text-xs text-slate-400">
                    Inbox, broadcasts, and pipeline activity
                  </p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">
                  Connected
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Open chats", "38", "12 waiting for reply"],
                  ["Opted-in contacts", "2,480", "CSV import ready"],
                  ["Queued broadcasts", "4", "Server worker active"],
                  ["Pipeline value", "$18.6k", "14 open deals"],
                ].map(([label, value, note]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    Broadcast progress
                  </p>
                  <p className="text-xs text-slate-400">Approved template</p>
                </div>
                <div className="space-y-3">
                  {[
                    ["Sent", "72%"],
                    ["Delivered", "61%"],
                    ["Read", "44%"],
                  ].map(([label, width]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs text-slate-400">
                        <span>{label}</span>
                        <span>{width}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <LockKeyhole className="h-4 w-4 text-emerald-300" />
                    Safety controls
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    Opt-in checks, approved templates, pause, resume, cancel,
                    and failed-recipient retry.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <Zap className="h-4 w-4 text-emerald-300" />
                    Server queue
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    Campaigns continue from the VPS while the browser monitors
                    progress.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-emerald-300">Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              Everything a WhatsApp-first business needs
            </h2>
            <p className="mt-3 text-slate-400">
              Built for teams that need one place for customer conversations,
              contacts, campaigns, sales tracking, and follow-up.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-5"
              >
                <feature.icon className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-8 lg:grid-cols-[0.8fr_1fr] lg:px-10">
          <div>
            <p className="text-sm font-medium text-emerald-300">Plans</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              Self-hosted on your VPS
            </h2>
            <p className="mt-3 text-slate-400">
              The CRM runs on your infrastructure with Supabase as the backend.
              Meta may charge for WhatsApp template conversations depending on
              country and message category.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["Local setup", "VPS hosting", "Meta WhatsApp API"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-5"
              >
                <LayoutDashboard className="h-5 w-5 text-emerald-300" />
                <p className="mt-4 font-medium text-white">{item}</p>
                <p className="mt-2 text-sm text-slate-400">
                  Configured for controlled, production-style CRM operations.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 sm:px-8 md:flex-row md:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-white">
              Ready to manage WhatsApp customers professionally?
            </h2>
            <p className="mt-2 text-slate-400">
              Login to your CRM or create an account to start the setup flow.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/login">
              <Button
                variant="outline"
                className="h-11 w-full border-slate-700 px-5 text-slate-100 hover:bg-slate-800 hover:text-white sm:w-auto"
              >
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="h-11 w-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400 sm:w-auto">
                Register / Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
