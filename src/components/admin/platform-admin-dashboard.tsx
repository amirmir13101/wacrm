"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, BookOpen, Loader2, ShieldCheck, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminSummary {
  pending_users: number;
  approved_users: number;
  suspended_users: number;
  uploaded_lists: number;
  uploaded_contacts: number;
  published_articles: number;
  draft_articles: number;
}

export function PlatformAdminDashboard() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch("/api/admin/summary");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load admin summary");
        setSummary(body);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load admin summary");
      } finally {
        setLoading(false);
      }
    }
    void loadSummary();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-violet-300">Platform admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Admin dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage CRM customers, user access, manual payments, and uploaded contact lists.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading platform metrics...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="Pending users" value={summary?.pending_users ?? 0} />
          <Metric label="Approved users" value={summary?.approved_users ?? 0} />
          <Metric label="Suspended users" value={summary?.suspended_users ?? 0} />
          <Metric label="Uploaded lists" value={summary?.uploaded_lists ?? 0} />
          <Metric label="Uploaded contacts" value={summary?.uploaded_contacts ?? 0} />
          <Metric label="Published articles" value={summary?.published_articles ?? 0} />
          <Metric label="Article drafts" value={summary?.draft_articles ?? 0} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-violet-300" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Approve, suspend, reactivate, or permanently delete platform-managed CRM users.
            </p>
            <Link
              href="/admin/users"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open Users
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Upload className="h-5 w-5 text-cyan-300" />
              Uploaded Contact Lists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Review contact lists imported by CRM workspaces for platform oversight.
            </p>
            <Link
              href="/admin/contacts"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Open Contact Lists
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BadgeDollarSign className="h-5 w-5 text-emerald-300" />
              Manual Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Review Pro and Lifetime manual checkout requests before activating workspaces.
            </p>
            <Link
              href="/admin/payments"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Open Payments
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="h-5 w-5 text-amber-300" />
              Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Create drafts, preview editorial layouts, and publish approved blog articles.
            </p>
            <Link
              href="/admin/articles"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-slate-950 hover:bg-amber-400"
            >
              Open Articles
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-slate-900">
      <CardContent className="pt-6">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-sm text-slate-400">{label}</p>
      </CardContent>
    </Card>
  );
}
