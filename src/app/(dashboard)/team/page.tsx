"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { WorkspaceMemberOption } from "@/lib/team/assignment";
import {
  defaultPermissionsForRole,
  effectivePermissions,
  type WorkspacePermission,
  type WorkspacePermissions,
} from "@/lib/team/permissions";
import {
  MAIN_ACCESS_PERMISSIONS,
  type PermissionItem,
  ROLE_PRESETS,
  applyPermissionPreset,
  findMatchingPreset,
  permissionSummary,
} from "@/lib/team/permission-ui";

interface TeamResponse {
  workspace_id: string;
  workspace_name?: string | null;
  current_user_id: string;
  current_role: string;
  current_permissions?: WorkspacePermissions;
  can_manage_team: boolean;
  members: WorkspaceMemberOption[];
  invitations?: WorkspaceInvitation[];
  team_limit?: {
    limit: number;
    used: number;
    remaining: number;
    canInviteMore: boolean;
    message: string;
  } | null;
  workspaces?: Array<{
    workspace_id: string;
    workspace_name: string | null;
    role: string;
    status: string;
    is_active: boolean;
  }>;
}

interface WorkspaceInvitation {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_email?: string | null;
  invite_url?: string;
}

export default function TeamPage() {
  const router = useRouter();
  const deletedMemberIdsRef = useRef(new Set<string>());
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [newMemberPermissions, setNewMemberPermissions] = useState<WorkspacePermissions>(
    defaultPermissionsForRole("agent"),
  );
  const [newCanConnectOwnWhatsapp, setNewCanConnectOwnWhatsapp] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [creatingMember, setCreatingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    login_url: string;
    email: string;
    temporary_password: string;
  } | null>(null);
  const [deletingMemberIds, setDeletingMemberIds] = useState<Set<string>>(() => new Set());

  async function loadTeam(options: { showLoading?: boolean } = {}) {
    if (options.showLoading ?? true) setLoading(true);
    try {
      const res = await fetch("/api/team/members", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load team");
      }
      const nextPayload = payload as TeamResponse;
      if (deletedMemberIdsRef.current.size) {
        nextPayload.members = nextPayload.members.filter(
          (member) =>
            !deletedMemberIdsRef.current.has(member.id) &&
            !deletedMemberIdsRef.current.has(member.user_id),
        );
      }
      setData(nextPayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load team");
    } finally {
      if (options.showLoading ?? true) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/members", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load team");
        return payload as TeamResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setData({
          ...payload,
          members: payload.members.filter(
            (member) =>
              !deletedMemberIdsRef.current.has(member.id) &&
              !deletedMemberIdsRef.current.has(member.user_id),
          ),
        });
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load team");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createTeamMember() {
    setCreatingMember(true);
    setCreatedCredentials(null);
    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          temporary_password: temporaryPassword,
          confirm_temporary_password: confirmTemporaryPassword,
          role,
          permissions: newMemberPermissions,
          can_connect_own_whatsapp: newCanConnectOwnWhatsapp,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create team member");
      toast.success("Team member created");
      setCreatedCredentials({
        login_url: payload.login_url ?? `${window.location.origin}/login`,
        email: payload.email ?? email,
        temporary_password: payload.temporary_password ?? temporaryPassword,
      });
      setEmail("");
      setTemporaryPassword("");
      setConfirmTemporaryPassword("");
      setNewMemberPermissions(defaultPermissionsForRole(role));
      setNewCanConnectOwnWhatsapp(false);
      await loadTeam({ showLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team member");
    } finally {
      setCreatingMember(false);
    }
  }

  async function revokeInvite(id: string) {
    const res = await fetch("/api/team/invitations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "revoke" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error ?? "Failed to revoke invitation");
      return;
    }
    toast.success("Invitation revoked");
    await loadTeam({ showLoading: false });
  }

  async function deleteInvite(invite: WorkspaceInvitation) {
    if (invite.status === "accepted") {
      toast.info("Accepted invitations are kept for audit history.");
      return;
    }
    const confirmed = window.confirm(
      "Delete this invitation from the list? This action cannot be used to accept the invite.",
    );
    if (!confirmed) return;

    const res = await fetch("/api/team/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invite.id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error ?? "Failed to delete invitation");
      return;
    }
    toast.success("Invitation deleted from list");
    setData((current) =>
      current
        ? {
            ...current,
            invitations: current.invitations?.filter((item) => item.id !== invite.id) ?? [],
          }
        : current,
    );
    await loadTeam({ showLoading: false });
  }

  async function copyText(text: string, successMessage = "Copied") {
    try {
      await copyToClipboard(text);
      toast.success(successMessage);
    } catch {
      toast.error("Copy failed. Please copy manually.");
    }
  }

  async function updateMember(id: string, update: Record<string, unknown>) {
    const res = await fetch(`/api/team/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error ?? "Failed to update member");
    }
    setData((current) =>
      current
        ? {
            ...current,
            members: current.members.map((member) =>
              member.id === id ? { ...member, ...update } : member,
            ),
          }
        : current,
    );
    await loadTeam({ showLoading: false });
  }

  async function deleteMember(member: WorkspaceMemberOption) {
    const confirmed = window.confirm(
      "This will permanently delete this team member account and remove their workspace access.",
    );
    if (!confirmed) return;
    setDeletingMemberIds((current) => new Set(current).add(member.id));
    try {
      const res = await fetch(`/api/team/members/${member.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to delete team member");
      deletedMemberIdsRef.current.add(member.id);
      deletedMemberIdsRef.current.add(member.user_id);
      toast.success("Team member deleted");
      setData((current) =>
        current
          ? {
              ...current,
              members: current.members.filter(
                (item) => item.id !== member.id && item.user_id !== member.user_id,
              ),
            }
          : current,
      );
      router.refresh();
      await loadTeam({ showLoading: false });
    } catch (error) {
      throw error;
    } finally {
      setDeletingMemberIds((current) => {
        const next = new Set(current);
        next.delete(member.id);
        return next;
      });
    }
  }

  const activeMembers = useMemo(
    () => data?.members.filter((member) => member.status === "active") ?? [],
    [data?.members],
  );
  const pendingInvites = useMemo(
    () => data?.invitations?.filter((invite) => invite.status === "pending") ?? [],
    [data?.invitations],
  );
  const pastInvites = useMemo(
    () => data?.invitations?.filter((invite) => invite.status !== "pending") ?? [],
    [data?.invitations],
  );
  const teamLimit = data?.team_limit ?? null;
  const teamLimitReached = Boolean(teamLimit && !teamLimit.canInviteMore);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage agents, assignment access, and team workload.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          Your role: {data?.current_role ?? "loading"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Users} label="Active members" value={activeMembers.length} />
        <MetricCard
          icon={MessageSquare}
          label="Open assigned conversations"
          value={activeMembers.reduce((sum, member) => sum + (member.open_conversations ?? 0), 0)}
        />
        <MetricCard
          icon={Briefcase}
          label="Open assigned deals"
          value={activeMembers.reduce((sum, member) => sum + (member.assigned_deals ?? 0), 0)}
        />
      </div>

      {data?.can_manage_team && (
        <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-900 p-4 transition-colors hover:border-[#3ddf84]/80">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 size-4 text-violet-300" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Add Team Member</h2>
              <p className="mt-1 text-xs text-slate-500">
                Create an agent login for this workspace. The agent must change the temporary password on first login.
              </p>
            </div>
            {teamLimit && (
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                {teamLimit.used}/{teamLimit.limit} team seats
              </span>
            )}
          </div>
          {teamLimitReached && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              {teamLimit?.message}
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_180px_180px_160px_auto]">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              className="border-slate-700 bg-slate-800 text-white"
            />
            <Input
              type="password"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Temporary password"
              className="border-slate-700 bg-slate-800 text-white"
            />
            <Input
              type="password"
              value={confirmTemporaryPassword}
              onChange={(e) => setConfirmTemporaryPassword(e.target.value)}
              placeholder="Confirm password"
              className="border-slate-700 bg-slate-800 text-white"
            />
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setNewMemberPermissions(defaultPermissionsForRole(e.target.value));
              }}
              className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-white"
            >
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              onClick={createTeamMember}
              disabled={
                teamLimitReached ||
                creatingMember ||
                !email.trim() ||
                !temporaryPassword ||
                !confirmTemporaryPassword
              }
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {creatingMember ? "Creating..." : "Create Team Member"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The temporary password is shown only once. Share it securely; it is not stored in plain text.
          </p>
          {createdCredentials && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-medium text-emerald-100">Team member created</p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Share these login details securely. The password will not be shown again.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <CredentialBox
                  label="Login URL"
                  value={createdCredentials.login_url}
                  onCopy={(value) => copyText(value, "URL copied")}
                />
                <CredentialBox
                  label="Email"
                  value={createdCredentials.email}
                  onCopy={(value) => copyText(value, "Email copied")}
                />
                <CredentialBox
                  label="Temporary password"
                  value={createdCredentials.temporary_password}
                  onCopy={(value) => copyText(value, "Password copied")}
                  secret
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(
                    [
                      `CRM Login URL: ${createdCredentials.login_url}`,
                      `Email: ${createdCredentials.email}`,
                      `Temporary Password: ${createdCredentials.temporary_password}`,
                    ].join("\n"),
                    "Login details copied",
                  )
                }
                className="mt-3 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/10"
              >
                Copy all login details
              </Button>
            </div>
          )}
          <div className="mt-4 rounded-lg border border-[#3ddf84]/60 bg-slate-950/40 p-3 transition-colors hover:border-[#3ddf84]/80">
            <PermissionEditor
              permissions={newMemberPermissions}
              disabled={false}
              canConnectOwnWhatsapp={newCanConnectOwnWhatsapp}
              onToggle={(permission, checked) =>
                setNewMemberPermissions((prev) => ({ ...prev, [permission]: checked }))
              }
              onSetPermissions={setNewMemberPermissions}
              onToggleOwnWhatsapp={setNewCanConnectOwnWhatsapp}
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Members and workload</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading team...</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {data?.members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                currentUserId={data.current_user_id}
                canManageTeam={data.can_manage_team}
                onSave={async (update) => updateMember(member.id, update)}
                onDelete={() => deleteMember(member)}
                isDeleting={deletingMemberIds.has(member.id)}
              />
            ))}
          </div>
        )}
      </div>

      {data?.can_manage_team && (
        <div className="overflow-hidden rounded-lg border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Legacy pending invitations</h2>
            <p className="mt-1 text-xs text-slate-500">
              Legacy invite links are kept for backward compatibility. New agents should be created with Add Team Member.
            </p>
          </div>
          {pendingInvites.length ? (
            <div className="divide-y divide-slate-800">
              {pendingInvites.map((invite) => (
                <InvitationRow
                  key={invite.id}
                  invite={invite}
                  onCopy={copyText}
                  onRevoke={revokeInvite}
                  onDelete={deleteInvite}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-slate-500">No legacy pending invitations.</div>
          )}
        </div>
      )}

      {data?.can_manage_team && pastInvites.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Past invitations</h2>
            <p className="mt-1 text-xs text-slate-500">
              Accepted, revoked, and expired invitations are kept for audit history.
            </p>
          </div>
          <div className="divide-y divide-slate-800">
            {pastInvites.map((invite) => (
              <InvitationRow
                key={invite.id}
                invite={invite}
                onCopy={copyText}
                onRevoke={revokeInvite}
                onDelete={deleteInvite}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Fallback copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

function CredentialBox({
  label,
  value,
  secret,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  onCopy: (text: string) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-slate-950/50 p-3">
      <p className="text-[11px] font-medium uppercase text-emerald-100/70">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={value}
          readOnly
          type={secret ? "text" : "text"}
          aria-label={label}
          className="h-8 min-w-0 flex-1 border-slate-700 bg-slate-950 font-mono text-xs text-white"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onCopy(value)}
          className="border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

function InvitationRow({
  invite,
  onCopy,
  onRevoke,
  onDelete,
}: {
  invite: WorkspaceInvitation;
  onCopy: (text: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onDelete: (invite: WorkspaceInvitation) => Promise<void>;
}) {
  const isPending = invite.status === "pending";
  const canDelete = invite.status !== "accepted";
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_120px_110px_180px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{invite.invited_email}</p>
        <p className="text-xs text-slate-500">
          Expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>
        {isPending && !invite.invite_url && (
          <p className="mt-1 text-xs text-amber-200">
            Invite link was only shown when created. Revoke and create a new invite to generate a new link.
          </p>
        )}
      </div>
      <span className="text-xs capitalize text-slate-300">{invite.role}</span>
      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isPending
          ? "bg-violet-500/10 text-violet-200"
          : "bg-slate-800 text-slate-300"
      }`}>
        {invite.status}
      </span>
      <div className="flex gap-2">
        {invite.invite_url && isPending && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopy(invite.invite_url!)}
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Copy link
          </Button>
        )}
        {isPending && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(invite.id)}
            className="text-amber-200 hover:bg-amber-500/10"
          >
            Revoke
          </Button>
        )}
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(invite)}
            className="text-red-200 hover:bg-red-500/10"
          >
            Delete
          </Button>
        ) : (
          <span className="self-center text-xs text-slate-500">
            Kept for audit
          </span>
        )}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  currentUserId,
  canManageTeam,
  onSave,
  onDelete,
  isDeleting,
}: {
  member: WorkspaceMemberOption;
  currentUserId: string;
  canManageTeam: boolean;
  onSave: (update: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}) {
  const savedPermissions = useMemo(
    () =>
      effectivePermissions({
        role: member.role,
        permissions: member.permissions,
        can_connect_own_whatsapp: member.can_connect_own_whatsapp,
      }),
    [member.can_connect_own_whatsapp, member.permissions, member.role],
  );
  const [draftRole, setDraftRole] = useState(member.role);
  const [draftStatus, setDraftStatus] = useState(member.status);
  const [draftPermissions, setDraftPermissions] = useState<WorkspacePermissions>(savedPermissions);
  const [draftOwnWhatsapp, setDraftOwnWhatsapp] = useState(Boolean(member.can_connect_own_whatsapp));
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraftRole(member.role);
    setDraftStatus(member.status);
    setDraftPermissions(savedPermissions);
    setDraftOwnWhatsapp(Boolean(member.can_connect_own_whatsapp));
  }, [member.can_connect_own_whatsapp, member.role, member.status, savedPermissions]);

  const savedSnapshot = useMemo(
    () =>
      JSON.stringify({
        role: member.role,
        status: member.status,
        permissions: savedPermissions,
        can_connect_own_whatsapp: Boolean(member.can_connect_own_whatsapp),
      }),
    [member.can_connect_own_whatsapp, member.role, member.status, savedPermissions],
  );
  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        role: draftRole,
        status: draftStatus,
        permissions: draftPermissions,
        can_connect_own_whatsapp: draftOwnWhatsapp,
      }),
    [draftOwnWhatsapp, draftPermissions, draftRole, draftStatus],
  );
  const hasChanges = savedSnapshot !== draftSnapshot;
  const editorPermissions = useMemo(
    () => ({ ...draftPermissions, connect_own_whatsapp_config: draftOwnWhatsapp }),
    [draftOwnWhatsapp, draftPermissions],
  );
  const preset = findMatchingPreset(editorPermissions);
  const summary = permissionSummary(editorPermissions);
  const enabledPermissions = Object.values(editorPermissions).filter(Boolean).length;
  const canEdit = canManageTeam && member.role !== "owner";
  const canDeleteMember = canEdit && member.account_type === "team_member";

  function resetDraft() {
    setDraftRole(member.role);
    setDraftStatus(member.status);
    setDraftPermissions(savedPermissions);
    setDraftOwnWhatsapp(Boolean(member.can_connect_own_whatsapp));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await onSave({
        role: draftRole,
        status: draftStatus,
        permissions: draftPermissions,
        can_connect_own_whatsapp: draftOwnWhatsapp,
      });
      toast.success("Permissions updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraftMember() {
    setDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete team member");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="m-3 overflow-hidden rounded-xl border border-[#3ddf84]/60 bg-slate-950/50 shadow-sm shadow-black/20 transition-colors hover:border-[#3ddf84]/80">
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white">
                {member.full_name || member.email || member.user_id}
                {member.user_id === currentUserId ? " (you)" : ""}
              </h3>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium capitalize text-violet-100">
                {draftRole}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                draftStatus === "active"
                  ? "bg-emerald-500/10 text-emerald-200"
                  : draftStatus === "suspended"
                    ? "bg-amber-500/10 text-amber-200"
                    : "bg-slate-800 text-slate-300"
              }`}>
                {draftStatus}
              </span>
              {hasChanges && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-100">
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{member.email}</p>
            <p className="mt-2 text-xs text-slate-400">
              {preset?.label ?? "Custom permissions"} / {enabledPermissions} permissions enabled
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 sm:flex sm:items-center">
            <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1">
              {member.open_conversations ?? 0} conversations
            </span>
            <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1">
              {member.assigned_deals ?? 0} deals
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-[160px_160px_1fr] md:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Role</label>
            <select
              value={draftRole}
              onChange={(event) => setDraftRole(event.target.value as WorkspaceMemberOption["role"])}
              disabled={!canEdit}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white disabled:opacity-60"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Status</label>
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as WorkspaceMemberOption["status"])}
              disabled={!canEdit}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white disabled:opacity-60"
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <SummaryTile label="Access" value={summary.access} wide />
            <SummaryTile label="Reply" value={summary.canReply ? "Yes" : "No"} />
            <SummaryTile label="Broadcast" value={summary.canBroadcast ? "Yes" : "No"} />
            <SummaryTile label="WhatsApp" value={summary.whatsapp} wide />
          </div>
        </div>

        {canManageTeam && member.role !== "owner" && (
          <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
            <button
              type="button"
              onClick={() => setPermissionsOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/60"
              aria-expanded={permissionsOpen}
            >
              <div>
                <p className="text-sm font-semibold text-white">View/Edit permissions</p>
                <p className="mt-1 text-xs text-slate-500">
                  Changes stay as a draft until you click Save changes.
                </p>
              </div>
              <ChevronDown
                className={`size-4 text-slate-500 transition-transform ${permissionsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {permissionsOpen && (
              <div className="border-t border-slate-800 p-3">
                <PermissionEditor
                  permissions={draftPermissions}
                  disabled={!canEdit || saving}
                  canConnectOwnWhatsapp={draftOwnWhatsapp}
                  onToggle={(permission, checked) =>
                    setDraftPermissions((prev) => ({ ...prev, [permission]: checked }))
                  }
                  onSetPermissions={setDraftPermissions}
                  onToggleOwnWhatsapp={setDraftOwnWhatsapp}
                />
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <p className={`text-xs ${hasChanges ? "text-amber-200" : "text-slate-500"}`}>
              {hasChanges ? "You have unsaved changes." : "No permission changes."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!hasChanges || saving}
                onClick={resetDraft}
                className="text-slate-300 hover:bg-slate-800"
              >
                Reset to saved
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!hasChanges || saving}
                onClick={resetDraft}
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!hasChanges || saving || deleting || isDeleting}
                onClick={saveDraft}
                className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
              {canDeleteMember && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting || isDeleting}
                  onClick={() => void deleteDraftMember()}
                >
                  {deleting || isDeleting ? "Deleting..." : "Delete member"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PermissionEditor({
  permissions,
  disabled,
  canConnectOwnWhatsapp,
  onToggle,
  onSetPermissions,
  onToggleOwnWhatsapp,
}: {
  permissions: WorkspacePermissions;
  disabled: boolean;
  canConnectOwnWhatsapp: boolean;
  onToggle: (permission: WorkspacePermission, checked: boolean) => void;
  onSetPermissions: (permissions: WorkspacePermissions) => void;
  onToggleOwnWhatsapp: (checked: boolean) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const editorPermissions = useMemo(
    () => ({
      ...permissions,
      connect_own_whatsapp_config: canConnectOwnWhatsapp,
    }),
    [canConnectOwnWhatsapp, permissions],
  );
  const matchingPreset = findMatchingPreset(editorPermissions);
  const summary = permissionSummary(editorPermissions);

  function applyPreset(presetId: string) {
    const preset = applyPermissionPreset(presetId);
    onSetPermissions(preset.permissions);
    onToggleOwnWhatsapp(preset.canConnectOwnWhatsapp);
  }

  function setItems(items: PermissionItem[], enabled: boolean) {
    const next = {
      ...editorPermissions,
      ...Object.fromEntries(items.map((item) => [item.key, enabled])),
    };
    onSetPermissions(next);
    if (items.some((item) => item.key === "connect_own_whatsapp_config")) {
      onToggleOwnWhatsapp(Boolean(next.connect_own_whatsapp_config));
    }
  }

  function togglePermission(permission: WorkspacePermission, checked: boolean) {
    onToggle(permission, checked);
    if (permission === "connect_own_whatsapp_config") {
      onToggleOwnWhatsapp(checked);
    }
  }

  return (
    <div className="space-y-4" data-testid="permission-editor">
      <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-950/40 p-4 transition-colors hover:border-[#3ddf84]/80">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-violet-300" />
          <div>
            <p className="text-sm font-semibold text-white">Step 2: Choose a permission preset</p>
            <p className="mt-1 text-xs text-slate-500">
              Pick the closest job type. Advanced permissions stay hidden unless you need them.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {ROLE_PRESETS.map((preset) => {
            const active = matchingPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPreset(preset.id)}
                className={`min-h-24 rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-[#3ddf84] bg-[#3ddf84] text-[#07130e] shadow-[0_14px_32px_rgba(61,223,132,0.18)]"
                    : "border-[#3ddf84]/60 bg-slate-900 hover:border-[#3ddf84]/80"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${active ? "text-[#07130e]" : "text-white"}`}>
                    {preset.label}
                  </p>
                  {active && (
                    <span className="rounded-full bg-[#07130e]/15 px-2 py-0.5 text-[10px] font-bold text-[#07130e]">
                      selected
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-xs leading-5 ${active ? "font-medium text-[#0b241c]" : "text-slate-400"}`}>
                  {preset.helper}
                </p>
              </button>
            );
          })}
        </div>
        {!matchingPreset && (
          <div className="mt-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-100">
            Custom permissions
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-900 p-4 transition-colors hover:border-[#3ddf84]/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Step 3: Review access summary</p>
            <p className="mt-1 text-xs text-slate-500">
              This is what the member can do with the selected permissions.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
            {matchingPreset?.label ?? "Custom permissions"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryTile label="Access" value={summary.access} />
          <SummaryTile label="Can reply" value={summary.canReply ? "Yes" : "No"} />
          <SummaryTile label="Can broadcast" value={summary.canBroadcast ? "Yes" : "No"} />
          <SummaryTile label="Settings" value={summary.canManageSettings ? "Can manage" : "View only"} />
          <SummaryTile label="WhatsApp" value={summary.whatsapp} wide />
        </div>
      </div>

      <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/60"
          aria-expanded={advancedOpen}
        >
          <div>
            <p className="text-sm font-semibold text-white">Step 4: Advanced permissions</p>
            <p className="mt-1 text-xs text-slate-500">
              Optional. Open only when a preset needs fine tuning.
            </p>
          </div>
          <ChevronDown
            className={`size-4 text-slate-500 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-4 border-t border-slate-800 p-4">
            <PermissionSection
              title="Main access"
              helper="Which main CRM tabs this member can open."
              items={MAIN_ACCESS_PERMISSIONS.map((item) => ({ ...item, key: item.key }))}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <PermissionSection
              title="Conversation permissions"
              helper="Chat visibility and reply controls."
              items={[
                { key: "view_assigned_conversations", label: "View assigned conversations" },
                { key: "view_unassigned_conversations", label: "View unassigned conversations" },
                { key: "view_all_conversations", label: "View all conversations" },
                { key: "reply_to_conversations", label: "Reply to conversations" },
                { key: "assign_conversations", label: "Assign conversations" },
                { key: "close_conversations", label: "Close conversations" },
              ]}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <PermissionSection
              title="Contact permissions"
              helper="Contact visibility and contact record actions."
              items={[
                { key: "view_assigned_contacts", label: "View assigned contacts" },
                { key: "view_all_contacts", label: "View all contacts" },
                { key: "create_contacts", label: "Create contacts" },
                { key: "edit_contacts", label: "Edit contacts" },
                { key: "delete_contacts", label: "Delete contacts", danger: true },
                { key: "export_contacts", label: "Export contacts", danger: true },
              ]}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <PermissionSection
              title="Sales / Pipeline permissions"
              helper="Deal visibility and sales pipeline actions."
              items={[
                { key: "view_assigned_deals", label: "View assigned deals" },
                { key: "view_all_deals", label: "View all deals" },
                { key: "create_deals", label: "Create deals" },
                { key: "edit_deals", label: "Edit deals" },
                { key: "assign_deals", label: "Assign deals" },
                { key: "mark_deal_won_lost", label: "Mark won/lost" },
              ]}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <PermissionSection
              title="Marketing permissions"
              helper="Broadcast and template actions."
              items={[
                { key: "create_broadcasts", label: "Create broadcasts" },
                { key: "queue_broadcasts", label: "Queue broadcasts", danger: true },
                {
                  key: "pause_resume_cancel_broadcasts",
                  label: "Pause/resume/cancel broadcasts",
                  danger: true,
                },
                { key: "view_broadcast_reports", label: "View broadcast reports" },
                { key: "view_templates", label: "View templates" },
                { key: "sync_templates", label: "Sync templates" },
                { key: "manage_local_templates", label: "Manage local templates" },
              ]}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <PermissionSection
              title="Automation permissions"
              helper="Workflow builder access and activation controls."
              items={[
                { key: "create_automations", label: "Create automations" },
                { key: "edit_automations", label: "Edit automations" },
                {
                  key: "activate_deactivate_automations",
                  label: "Activate/deactivate automations",
                },
              ]}
              permissions={editorPermissions}
              disabled={disabled}
              onToggle={togglePermission}
              onSetItems={setItems}
            />

            <div className="overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/5">
              <button
                type="button"
                onClick={() => setAdminOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                aria-expanded={adminOpen}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold text-amber-100">
                      Advanced admin permissions
                    </p>
                    <p className="mt-0.5 text-xs text-amber-100/70">
                      Settings, pricing, team, exports, and WhatsApp connection controls.
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`size-4 text-amber-200 transition-transform ${adminOpen ? "rotate-180" : ""}`}
                />
              </button>
              {adminOpen && (
                <div className="space-y-4 border-t border-amber-500/20 p-3">
                  <PermissionSection
                    title="Reports and pricing"
                    helper="Reporting exports and pricing rate management."
                    items={[
                      { key: "export_reports", label: "Export reports", danger: true },
                      { key: "view_pricing", label: "View pricing" },
                      { key: "use_cost_calculator", label: "Use cost calculator" },
                      { key: "manage_pricing_rates", label: "Manage pricing rates", danger: true },
                    ]}
                    permissions={editorPermissions}
                    disabled={disabled}
                    onToggle={togglePermission}
                    onSetItems={setItems}
                  />
                  <PermissionSection
                    title="Settings and team"
                    helper="Workspace settings and member management."
                    items={[
                      { key: "view_settings", label: "View settings" },
                      {
                        key: "manage_whatsapp_config",
                        label: "Manage WhatsApp config",
                        danger: true,
                      },
                      { key: "manage_business_settings", label: "Manage business settings" },
                      { key: "view_team", label: "View team" },
                      { key: "manage_team_members", label: "Manage team members", danger: true },
                      { key: "edit_team_permissions", label: "Edit team permissions", danger: true },
                    ]}
                    permissions={editorPermissions}
                    disabled={disabled}
                    onToggle={togglePermission}
                    onSetItems={setItems}
                  />
                  <PermissionSection
                    title="WhatsApp connection"
                    helper="Most agents should use the workspace connection."
                    items={[
                      {
                        key: "use_workspace_whatsapp_config",
                        label: "Use workspace WhatsApp connection",
                      },
                      {
                        key: "connect_own_whatsapp_config",
                        label: "Allow own WhatsApp connection",
                        danger: true,
                      },
                    ]}
                    permissions={editorPermissions}
                    disabled={disabled}
                    onToggle={togglePermission}
                    onSetItems={setItems}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-md border border-[#3ddf84]/60 bg-slate-950/50 p-3 transition-colors hover:border-[#3ddf84]/80 ${wide ? "md:col-span-2 xl:col-span-4" : ""}`}>
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}

function PermissionSection({
  title,
  helper,
  items,
  permissions,
  disabled,
  onToggle,
  onSetItems,
}: {
  title: string;
  helper: string;
  items: PermissionItem[];
  permissions: WorkspacePermissions;
  disabled: boolean;
  onToggle: (permission: WorkspacePermission, checked: boolean) => void;
  onSetItems: (items: PermissionItem[], enabled: boolean) => void;
}) {
  const enabled = items.filter((item) => permissions[item.key] === true).length;

  return (
    <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-950/40 p-3 transition-colors hover:border-[#3ddf84]/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{title}</p>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
              {enabled} of {items.length} enabled
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onSetItems(items, true)}
            className="h-7 px-2 text-xs text-violet-200 hover:bg-violet-500/10"
          >
            Select
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onSetItems(items, false)}
            className="h-7 px-2 text-xs text-slate-400 hover:bg-slate-800"
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <label
            key={item.key}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
              item.danger
                ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
                : "border-slate-800 bg-slate-900 text-slate-300"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {item.danger && <AlertTriangle className="size-3 text-amber-300" />}
              {item.label}
            </span>
            <Switch
              checked={permissions[item.key] === true}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(item.key, Boolean(checked))}
              aria-label={item.label}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserCheck;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-[#3ddf84]/60 bg-slate-900 p-4 transition-colors hover:border-[#3ddf84]/80">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4 text-violet-400" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

