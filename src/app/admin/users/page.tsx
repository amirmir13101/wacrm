"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ShieldOff,
  Trash2,
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
  deleted_at?: string | null;
  delete_reason?: string | null;
  created_at: string;
}

interface OwnedWorkspaceDeleteOption {
  id: string;
  name: string;
  candidates: Array<{
    user_id: string;
    full_name: string | null;
    email: string | null;
    role: string;
  }>;
}

const statusClass: Record<ApprovalStatus, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  rejected: "border-red-400/30 bg-red-400/10 text-red-200",
  suspended: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  deleted: "border-red-500/40 bg-red-500/10 text-red-200",
};

type UserFilter = "active" | ApprovalStatus;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<UserFilter>("active");
  const [ownerDelete, setOwnerDelete] = useState<{
    user: AdminUser;
    workspaces: OwnedWorkspaceDeleteOption[];
    transfers: Record<string, string>;
    archiveConfirmation: string;
    mode: "transfer" | "archive";
  } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === "active" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/users${query}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load users");
      setUsers(body.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      deleted: users.filter((user) => user.approval_status === "deleted").length,
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

  const deleteUser = async (
    user: AdminUser,
    options?: {
      action?: "delete" | "transfer_delete" | "archive_delete";
      transfers?: Array<{ workspace_id: string; new_owner_user_id: string }>;
      confirmation?: string;
      deleteReason?: string;
      skipDeletePrompt?: boolean;
    },
  ) => {
    if (!options?.skipDeletePrompt) {
      const typed = window.prompt(
        `Delete ${user.email}?\n\nThey will lose CRM access. Existing CRM history will be kept.\n\nType DELETE to confirm.`,
      );
      if (typed !== "DELETE") return;
    }

    setSavingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: options?.action ?? "delete",
          transfers: options?.transfers,
          confirmation: options?.confirmation,
          delete_reason: options?.deleteReason ?? "Deleted from Admin users page",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409 && body.requires_owner_action) {
          const workspaces = (body.owned_workspaces ?? []) as OwnedWorkspaceDeleteOption[];
          setOwnerDelete({
            user,
            workspaces,
            transfers: Object.fromEntries(
              workspaces.map((workspace) => [
                workspace.id,
                workspace.candidates[0]?.user_id ?? "",
              ]),
            ),
            archiveConfirmation: "",
            mode: workspaces.every((workspace) => workspace.candidates.length > 0)
              ? "transfer"
              : "archive",
          });
          toast.message("This user owns workspace(s). Choose transfer or archive.");
          return;
        }
        throw new Error(body.error ?? "Failed to delete user");
      }
      toast.success(options?.action === "archive_delete" ? "Workspace archived and user deleted" : "User deleted safely");
      setOwnerDelete(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setSavingId(null);
    }
  };

  const submitOwnerDelete = async () => {
    if (!ownerDelete) return;
    if (ownerDelete.mode === "transfer") {
      const missing = ownerDelete.workspaces.find(
        (workspace) => !ownerDelete.transfers[workspace.id],
      );
      if (missing) {
        toast.error(`Choose a new owner for ${missing.name}`);
        return;
      }
      await deleteUser(ownerDelete.user, {
        action: "transfer_delete",
        transfers: ownerDelete.workspaces.map((workspace) => ({
          workspace_id: workspace.id,
          new_owner_user_id: ownerDelete.transfers[workspace.id],
        })),
        deleteReason: "Workspace ownership transferred, then user soft-deleted",
        skipDeletePrompt: true,
      });
      return;
    }

    if (ownerDelete.archiveConfirmation !== "ARCHIVE DELETE") {
      toast.error("Type ARCHIVE DELETE to confirm workspace archive.");
      return;
    }
    await deleteUser(ownerDelete.user, {
      action: "archive_delete",
      confirmation: ownerDelete.archiveConfirmation,
      deleteReason: "Workspace archived, then owner soft-deleted",
      skipDeletePrompt: true,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin users</h1>
        <p className="mt-1 text-sm text-slate-400">
          Approve, reject, suspend, or reactivate CRM accounts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
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
        <StatCard icon={Trash2} label="Deleted users" value={counts.deleted} />
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {([
              ["active", "Active"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["suspended", "Suspended"],
              ["rejected", "Rejected"],
              ["deleted", "Deleted"],
            ] as Array<[UserFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
                className={
                  filter === value
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              >
                {label}
              </Button>
            ))}
          </div>
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
                        disabled={savingId === user.id || user.approval_status === "deleted"}
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
                            user.approval_status === "approved" ||
                            user.approval_status === "deleted"
                          }
                          onClick={() =>
                            updateUser(user.id, { approval_status: "approved" })
                          }
                        />
                        <ActionButton
                          label="Reject"
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "rejected" ||
                            user.approval_status === "deleted"
                          }
                          onClick={() =>
                            updateUser(user.id, { approval_status: "rejected" })
                          }
                        />
                        <ActionButton
                          label="Suspend"
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "suspended" ||
                            user.approval_status === "deleted"
                          }
                          onClick={() =>
                            updateUser(user.id, {
                              approval_status: "suspended",
                            })
                          }
                        />
                        <ActionButton
                          label={savingId === user.id ? "Deleting..." : "Delete"}
                          danger
                          disabled={
                            savingId === user.id ||
                            user.approval_status === "deleted"
                          }
                          onClick={() => void deleteUser(user)}
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

      {ownerDelete && (
        <OwnerDeleteModal
          state={ownerDelete}
          saving={savingId === ownerDelete.user.id}
          onClose={() => setOwnerDelete(null)}
          onModeChange={(mode) =>
            setOwnerDelete((current) => (current ? { ...current, mode } : current))
          }
          onTransferChange={(workspaceId, newOwnerUserId) =>
            setOwnerDelete((current) =>
              current
                ? {
                    ...current,
                    transfers: {
                      ...current.transfers,
                      [workspaceId]: newOwnerUserId,
                    },
                  }
                : current,
            )
          }
          onArchiveConfirmationChange={(archiveConfirmation) =>
            setOwnerDelete((current) =>
              current ? { ...current, archiveConfirmation } : current,
            )
          }
          onSubmit={() => void submitOwnerDelete()}
        />
      )}
    </div>
  );
}

function OwnerDeleteModal({
  state,
  saving,
  onClose,
  onModeChange,
  onTransferChange,
  onArchiveConfirmationChange,
  onSubmit,
}: {
  state: {
    user: AdminUser;
    workspaces: OwnedWorkspaceDeleteOption[];
    transfers: Record<string, string>;
    archiveConfirmation: string;
    mode: "transfer" | "archive";
  };
  saving: boolean;
  onClose: () => void;
  onModeChange: (mode: "transfer" | "archive") => void;
  onTransferChange: (workspaceId: string, newOwnerUserId: string) => void;
  onArchiveConfirmationChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const canTransfer = state.workspaces.every((workspace) => workspace.candidates.length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-white">
            This user owns workspace(s)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose how to safely remove {state.user.email}. CRM history will be kept.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canTransfer || saving}
              onClick={() => onModeChange("transfer")}
              className={`rounded-lg border p-4 text-left ${
                state.mode === "transfer"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-slate-700 bg-slate-950/50"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <p className="text-sm font-semibold text-white">Transfer ownership</p>
              <p className="mt-1 text-xs text-slate-400">
                Move each workspace to another active member, then delete this user.
              </p>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onModeChange("archive")}
              className={`rounded-lg border p-4 text-left ${
                state.mode === "archive"
                  ? "border-red-500 bg-red-500/10"
                  : "border-slate-700 bg-slate-950/50"
              }`}
            >
              <p className="text-sm font-semibold text-white">Archive workspace and delete</p>
              <p className="mt-1 text-xs text-slate-400">
                Block workspace access, keep all history, and delete the owner.
              </p>
            </button>
          </div>

          {state.mode === "transfer" ? (
            <div className="space-y-3">
              {!canTransfer && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  One or more workspaces has no active member to receive ownership. Use archive instead.
                </div>
              )}
              {state.workspaces.map((workspace) => (
                <div key={workspace.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <label className="text-sm font-medium text-white">{workspace.name}</label>
                  <select
                    value={state.transfers[workspace.id] ?? ""}
                    disabled={saving || workspace.candidates.length === 0}
                    onChange={(event) => onTransferChange(workspace.id, event.target.value)}
                    className="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                  >
                    {workspace.candidates.length === 0 ? (
                      <option value="">No active member available</option>
                    ) : (
                      workspace.candidates.map((candidate) => (
                        <option key={candidate.user_id} value={candidate.user_id}>
                          {candidate.full_name || candidate.email || candidate.user_id} ({candidate.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-100">
                This will archive {state.workspaces.length} workspace(s), suspend members, and keep all CRM history.
              </p>
              <label className="mt-3 block text-xs font-medium text-red-100">
                Type ARCHIVE DELETE to confirm
              </label>
              <input
                value={state.archiveConfirmation}
                disabled={saving}
                onChange={(event) => onArchiveConfirmationChange(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-red-500/40 bg-slate-950 px-3 text-sm text-white"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 p-5">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || (state.mode === "transfer" && !canTransfer)}
            onClick={onSubmit}
            className={
              state.mode === "archive"
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-violet-600 text-white hover:bg-violet-500"
            }
          >
            {saving
              ? state.mode === "archive"
                ? "Archiving..."
                : "Transferring..."
              : state.mode === "archive"
                ? "Archive and delete"
                : "Transfer and delete"}
          </Button>
        </div>
      </div>
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
  danger,
  onClick,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? "border-red-500/40 text-red-200 hover:bg-red-500/10 hover:text-red-100"
          : "border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
      }
    >
      {label}
    </Button>
  );
}
