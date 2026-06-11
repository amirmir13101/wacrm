"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImportDetail {
  id: string;
  campaign_name: string | null;
  source: string | null;
  total_count: number;
  valid_count: number;
  invalid_count: number;
  created_at: string;
  workspace?: { name?: string | null } | Array<{ name?: string | null }> | null;
  uploader?: { full_name?: string | null; email?: string | null } | null;
}

interface ImportRow {
  id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  category: string | null;
  opt_in_status: string | null;
  created_at: string;
}

export default function AdminContactImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [importDetail, setImportDetail] = useState<ImportDetail | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImport() {
      try {
        const res = await fetch(`/api/admin/contact-imports/${id}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load import");
        setImportDetail(body.import);
        setRows(body.rows ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load import");
      } finally {
        setLoading(false);
      }
    }
    void loadImport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading contact list...
      </div>
    );
  }

  if (!importDetail) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
        Contact import not found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/contacts"
        className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to lists
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">
          {importDetail.campaign_name || "Contact import"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {workspaceName(importDetail.workspace)} · {importDetail.uploader?.email || "Unknown user"} ·{" "}
          {new Date(importDetail.created_at).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total rows" value={importDetail.total_count} />
        <Metric label="Valid/imported" value={importDetail.valid_count} />
        <Metric label="Invalid/failed" value={importDetail.invalid_count} />
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Rows</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              No rows recorded for this import.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-300">Name</TableHead>
                  <TableHead className="text-slate-300">Phone</TableHead>
                  <TableHead className="text-slate-300">City</TableHead>
                  <TableHead className="text-slate-300">Category</TableHead>
                  <TableHead className="text-slate-300">Opt-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="border-slate-800">
                    <TableCell className="text-slate-200">{row.name || "-"}</TableCell>
                    <TableCell className="font-mono text-slate-200">{row.phone || "-"}</TableCell>
                    <TableCell className="text-slate-300">{row.city || "-"}</TableCell>
                    <TableCell className="text-slate-300">{row.category || "-"}</TableCell>
                    <TableCell className="text-slate-300">{row.opt_in_status || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="pt-6">
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-sm text-slate-400">{label}</p>
      </CardContent>
    </Card>
  );
}

function workspaceName(workspace: ImportDetail["workspace"]) {
  if (Array.isArray(workspace)) return workspace[0]?.name || "Unknown workspace";
  return workspace?.name || "Unknown workspace";
}
