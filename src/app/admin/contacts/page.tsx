"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;

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

function initialNumberParam(name: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export default function AdminContactImportsPage() {
  const [imports, setImports] = useState<ContactImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => initialNumberParam("page", 1));
  const [pageSize, setPageSize] = useState(() => {
    const requested = initialNumberParam("pageSize", 50);
    return PAGE_SIZE_OPTIONS.includes(requested as (typeof PAGE_SIZE_OPTIONS)[number])
      ? requested
      : 50;
  });
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    imports.length > 0 && imports.every((item) => selectedIds.has(item.id));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const syncUrl = useCallback((nextPage: number, nextPageSize: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(nextPage));
    url.searchParams.set("pageSize", String(nextPageSize));
    window.history.replaceState(null, "", url.toString());
  }, []);

  const loadImports = useCallback(
    async (nextPage = page, nextPageSize = pageSize) => {
      setLoading(true);
      try {
        syncUrl(nextPage, nextPageSize);
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(nextPageSize),
        });
        const res = await fetch(`/api/admin/contact-imports?${params.toString()}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load contact lists");
        setImports(body.imports ?? []);
        setTotal(body.total ?? 0);
        setSelectedIds(new Set());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load contact lists");
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, syncUrl],
  );

  useEffect(() => {
    void loadImports(page, pageSize);
  }, [loadImports, page, pageSize]);

  const selectedLabel = useMemo(() => {
    if (confirmIds.length === 1) return "Delete this uploaded contact list?";
    return `Delete ${confirmIds.length} uploaded contact lists?`;
  }, [confirmIds.length]);

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of imports) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function changePageSize(value: string) {
    const nextPageSize = Number(value);
    setPageSize(nextPageSize);
    setPage(1);
  }

  async function deleteImports() {
    if (confirmIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/contact-imports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: confirmIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to delete contact lists");

      toast.success(
        confirmIds.length === 1
          ? "Uploaded contact list deleted."
          : `${confirmIds.length} uploaded contact lists deleted.`,
      );
      const deletedIds = new Set(confirmIds);
      const deletedVisibleCount = imports.filter((item) => deletedIds.has(item.id)).length;
      const nextTotal = Math.max(0, total - confirmIds.length);
      const nextPage = page > 1 && (page - 1) * pageSize >= nextTotal ? page - 1 : page;
      setConfirmIds([]);
      setSelectedIds(new Set());
      setImports((current) => current.filter((item) => !deletedIds.has(item.id)));
      setTotal((current) => Math.max(0, current - deletedVisibleCount));
      setPage(nextPage);
      await loadImports(nextPage, pageSize);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete contact lists");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Uploaded contact lists</h1>
          <p className="mt-1 text-sm text-slate-400">
            Platform view of contact CSV imports across CRM workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => changePageSize(event.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-white">Imports</CardTitle>
            <CardDescription>
              Lists are grouped by workspace, uploader, campaign/file name, and upload date.
            </CardDescription>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-sm text-slate-400">
              Showing {rangeStart}-{rangeEnd} of {total} lists
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 ? (
                <>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
                    {selectedCount} selected
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={() => setConfirmIds(Array.from(selectedIds))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Bulk Delete
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contact lists...
            </div>
          ) : imports.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              No uploaded contact lists yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-10 text-slate-300">
                      <input
                        type="checkbox"
                        aria-label="Select all contact lists on this page"
                        checked={allVisibleSelected}
                        onChange={(event) => toggleVisible(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                      />
                    </TableHead>
                    <TableHead className="text-slate-300">List</TableHead>
                    <TableHead className="text-slate-300">Workspace</TableHead>
                    <TableHead className="text-slate-300">Uploaded by</TableHead>
                    <TableHead className="text-slate-300">Contacts</TableHead>
                    <TableHead className="text-slate-300">Invalid</TableHead>
                    <TableHead className="text-slate-300">Uploaded</TableHead>
                    <TableHead className="text-right text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((item) => (
                    <TableRow key={item.id} className="border-slate-800">
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.campaign_name || "contact import"}`}
                          checked={selectedIds.has(item.id)}
                          onChange={(event) => toggleOne(item.id, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                      </TableCell>
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
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/contacts/${item.id}`}
                            className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
                          >
                            Open
                          </Link>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deleting}
                            onClick={() => setConfirmIds([item.id])}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Showing {rangeStart}-{rangeEnd} of {total} lists
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {confirmIds.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">{selectedLabel}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This removes only platform admin import audit records and their uploaded rows.
              It does not delete the original workspace contacts.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setConfirmIds([])}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => void deleteImports()}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function workspaceName(workspace: ContactImport["workspace"]) {
  if (Array.isArray(workspace)) return workspace[0]?.name || "Unknown workspace";
  return workspace?.name || "Unknown workspace";
}
