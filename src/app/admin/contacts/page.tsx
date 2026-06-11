"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ContactImport {
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

export default function AdminContactImportsPage() {
  const [imports, setImports] = useState<ContactImport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImports() {
      try {
        const res = await fetch("/api/admin/contact-imports");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load contact lists");
        setImports(body.imports ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load contact lists");
      } finally {
        setLoading(false);
      }
    }
    void loadImports();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Uploaded contact lists</h1>
        <p className="mt-1 text-sm text-slate-400">
          Platform view of contact CSV imports across CRM workspaces.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Imports</CardTitle>
          <CardDescription>
            Lists are grouped by workspace, uploader, campaign/file name, and upload date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contact lists...
            </div>
          ) : imports.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              No uploaded contact lists recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-300">List</TableHead>
                  <TableHead className="text-slate-300">Workspace</TableHead>
                  <TableHead className="text-slate-300">Uploaded by</TableHead>
                  <TableHead className="text-slate-300">Contacts</TableHead>
                  <TableHead className="text-slate-300">Invalid</TableHead>
                  <TableHead className="text-slate-300">Uploaded</TableHead>
                  <TableHead className="text-right text-slate-300">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((item) => (
                  <TableRow key={item.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">
                      {item.campaign_name || "Contact import"}
                      <p className="text-xs font-normal text-slate-500">{item.source || "contacts_csv"}</p>
                    </TableCell>
                    <TableCell className="text-slate-300">{workspaceName(item.workspace)}</TableCell>
                    <TableCell className="text-slate-300">
                      {item.uploader?.full_name || item.uploader?.email || "Unknown user"}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {item.valid_count} / {item.total_count}
                    </TableCell>
                    <TableCell className="text-slate-300">{item.invalid_count}</TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/contacts/${item.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Open
                      </Link>
                    </TableCell>
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

function workspaceName(workspace: ContactImport["workspace"]) {
  if (Array.isArray(workspace)) return workspace[0]?.name || "Unknown workspace";
  return workspace?.name || "Unknown workspace";
}
