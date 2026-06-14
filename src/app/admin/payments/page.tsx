"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PaymentStatus = "pending" | "approved" | "rejected" | "all";

interface ManualPaymentRequest {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  plan_type: "pro" | "lifetime";
  amount: number;
  currency: string;
  payment_method: "easypaisa" | "bank_transfer";
  payer_name: string;
  payer_email: string;
  phone: string | null;
  company_name: string | null;
  workspace_name: string | null;
  transaction_reference: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  auth_user_created: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  workspace?: { name?: string | null; plan_type?: string | null; subscription_status?: string | null } | null;
  profile?: { full_name?: string | null; email?: string | null } | null;
}

const filters: Array<{ value: PaymentStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function AdminPaymentsPage() {
  const [requests, setRequests] = useState<ManualPaymentRequest[]>([]);
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests],
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payments?status=${status}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load payment requests");
      setRequests(payload.requests ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load payment requests");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function reviewRequest(id: string, action: "approve" | "reject") {
    setSavingId(id);
    try {
      const response = await fetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, admin_note: notes[id] ?? "" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update payment request");
      toast.success(action === "approve" ? "Payment approved and workspace activated." : "Payment request rejected.");
      setRequests((current) =>
        status === "pending" ? current.filter((request) => request.id !== id) : current,
      );
      if (status !== "pending") void loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payment request");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-violet-300">Platform admin</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Manual payments</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review Pro and Lifetime manual checkout requests, then activate workspaces after proof is confirmed.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-white">{pendingCount}</span> pending in this view
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatus(filter.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === filter.value
                ? "bg-violet-600 text-white"
                : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BadgeDollarSign className="h-5 w-5 text-violet-300" />
            Payment requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-400">
              No manual payment requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Customer</TableHead>
                    <TableHead className="text-slate-400">Plan</TableHead>
                    <TableHead className="text-slate-400">Method</TableHead>
                    <TableHead className="text-slate-400">Workspace</TableHead>
                    <TableHead className="text-slate-400">Reference</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="min-w-80 text-slate-400">Admin review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="border-slate-800">
                      <TableCell className="align-top text-slate-200">
                        <div className="font-semibold">{request.payer_name}</div>
                        <div className="text-xs text-slate-500">{request.payer_email}</div>
                        {request.phone ? <div className="text-xs text-slate-500">{request.phone}</div> : null}
                        <div className="mt-1 text-xs text-slate-500">
                          {new Date(request.created_at).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-slate-200">
                        <div className="font-semibold capitalize">{request.plan_type}</div>
                        <div className="text-xs text-slate-500">
                          {request.currency} {request.amount}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-slate-200">
                        {request.payment_method === "bank_transfer" ? "Bank Transfer" : "Easypaisa"}
                      </TableCell>
                      <TableCell className="align-top text-slate-200">
                        <div>{request.workspace?.name ?? request.workspace_name ?? request.company_name ?? "Not linked"}</div>
                        {request.company_name ? (
                          <div className="mt-1 text-xs text-slate-500">Company: {request.company_name}</div>
                        ) : null}
                        {request.auth_user_created ? (
                          <div className="mt-1 text-xs text-emerald-300">Checkout created customer login</div>
                        ) : null}
                        {!request.workspace_id ? (
                          <div className="mt-1 text-xs text-amber-300">
                            Not linked yet. Ask customer to resubmit checkout if approval fails.
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-slate-300">
                        <div>{request.transaction_reference || "Not provided"}</div>
                        {request.note ? <div className="mt-1 text-xs text-slate-500">{request.note}</div> : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className={statusClass(request.status)}>{request.status}</span>
                      </TableCell>
                      <TableCell className="align-top">
                        {request.status === "pending" ? (
                          <div className="space-y-3">
                            <textarea
                              value={notes[request.id] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                              }
                              className="min-h-20 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                              placeholder="Optional admin note"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingId === request.id}
                                onClick={() => void reviewRequest(request.id, "approve")}
                                className="bg-emerald-600 text-white hover:bg-emerald-500"
                              >
                                {savingId === request.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingId === request.id}
                                onClick={() => void reviewRequest(request.id, "reject")}
                                className="bg-rose-600 text-white hover:bg-rose-500"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">
                            {request.admin_note || "Reviewed"}
                            <div className="mt-1 text-xs text-slate-500">
                              {request.approved_at || request.rejected_at
                                ? new Date(request.approved_at ?? request.rejected_at ?? "").toLocaleString()
                                : null}
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function statusClass(status: ManualPaymentRequest["status"]) {
  if (status === "approved") {
    return "inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300";
  }
  if (status === "rejected") {
    return "inline-flex rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300";
  }
  return "inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300";
}
