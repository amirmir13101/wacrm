"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ShieldOff,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApprovalStatus, UserRole } from "@/lib/auth/approval";

interface AdminUser {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

const statusClass: Record<ApprovalStatus, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  rejected: "border-red-400/30 bg-red-400/10 text-red-200",
  suspended: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load users");
      setUsers(body.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const counts = useMemo(
    () => ({
      pending: users.filter((user) => user.approval_status === "pending").length,
      approved: users.filter((user) => user.approval_status === "approved").length,
      blocked: users.filter((user) =>
        ["rejected", "suspended"].includes(user.approval_status),
      ).length,
    }),
    [users],
  );

  const updateUser = async (
    userId: string,
    updates: Partial<Pick<AdminUser, "approval_status" | "role">>,
  ) => {
    setSavingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update user");

      setUsers((current) =>
        current.map((user) => (user.id === userId ? body.user : user)),
      );
      toast.success("User updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin users</h1>
        <p className="mt-1 text-sm text-slate-400">
          Approve, reject, suspend, or reactivate CRM accounts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UserCog}
          label="Pending approval"
          value={counts.pending}
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved users"
          value={counts.approved}
        />
        <StatCard icon={ShieldOff} label="Blocked users" value={counts.blocked} />
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">User access</CardTitle>
          <CardDescription>
            Only approved users can access CRM pages and protected APIs. Admin
            users can manage approvals from this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-300">User</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Role</TableHead>
                  <TableHead className="text-slate-300">Created</TableHead>
                  <TableHead className="text-right text-slate-300">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-slate-800">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">
                          {user.full_name || "Unnamed user"}
                        </p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[user.approval_status]}
                      >
                        {user.approval_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(event) =>
                          void updateUser(user.id, {
                            role: event.target.value as UserRole,
                          })
                        }
                        className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          label="Approve"
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "approved"
                          }
                          onClick={() =>
                            updateUser(user.id, { approval_status: "approved" })
                          }
                        />
                        <ActionButton
                          label="Reject"
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "rejected"
                          }
                          onClick={() =>
                            updateUser(user.id, { approval_status: "rejected" })
                          }
                        />
                        <ActionButton
                          label="Suspend"
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "suspended"
                          }
                          onClick={() =>
                            updateUser(user.id, {
                              approval_status: "suspended",
                            })
                          }
                        />
                      </div>
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
    >
      {label}
    </Button>
  );
}
