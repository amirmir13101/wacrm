"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserCheck, Users, MessageSquare, Briefcase, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceMemberOption } from "@/lib/team/assignment";
import {
  defaultPermissionsForRole,
  effectivePermissions,
  type WorkspacePermission,
  type WorkspacePermissions,
} from "@/lib/team/permissions";

interface TeamResponse {
  workspace_id: string;
  current_user_id: string;
  current_role: string;
  current_permissions?: WorkspacePermissions;
  can_manage_team: boolean;
  members: WorkspaceMemberOption[];
}

const PERMISSION_GROUPS: Array<{
  title: string;
  items: Array<{ key: WorkspacePermission; label: string }>;
}> = [
  {
    title: "Dashboard",
    items: [{ key: "view_dashboard", label: "View dashboard" }],
  },
  {
    title: "Inbox",
    items: [
      { key: "view_inbox", label: "View inbox" },
      { key: "view_all_conversations", label: "All conversations" },
      { key: "view_assigned_conversations", label: "Assigned conversations" },
      { key: "view_unassigned_conversations", label: "Unassigned conversations" },
      { key: "reply_to_conversations", label: "Reply" },
      { key: "assign_conversations", label: "Assign conversations" },
      { key: "close_conversations", label: "Close conversations" },
    ],
  },
  {
    title: "Contacts",
    items: [
      { key: "view_contacts", label: "View contacts" },
      { key: "view_all_contacts", label: "All contacts" },
      { key: "view_assigned_contacts", label: "Assigned contacts" },
      { key: "create_contacts", label: "Create" },
      { key: "edit_contacts", label: "Edit" },
      { key: "delete_contacts", label: "Delete" },
      { key: "export_contacts", label: "Export" },
    ],
  },
  {
    title: "Broadcasts",
    items: [
      { key: "view_broadcasts", label: "View" },
      { key: "create_broadcasts", label: "Create" },
      { key: "queue_broadcasts", label: "Queue" },
      { key: "pause_resume_cancel_broadcasts", label: "Pause/resume/cancel" },
      { key: "view_broadcast_reports", label: "Reports" },
    ],
  },
  {
    title: "Templates & Automations",
    items: [
      { key: "view_templates", label: "View templates" },
      { key: "sync_templates", label: "Sync templates" },
      { key: "manage_local_templates", label: "Manage local templates" },
      { key: "view_automations", label: "View automations" },
      { key: "create_automations", label: "Create automations" },
      { key: "edit_automations", label: "Edit automations" },
      { key: "activate_deactivate_automations", label: "Activate/deactivate" },
    ],
  },
  {
    title: "Pipeline",
    items: [
      { key: "view_pipeline", label: "View pipeline" },
      { key: "view_all_deals", label: "All deals" },
      { key: "view_assigned_deals", label: "Assigned deals" },
      { key: "create_deals", label: "Create deals" },
      { key: "edit_deals", label: "Edit deals" },
      { key: "assign_deals", label: "Assign deals" },
      { key: "mark_deal_won_lost", label: "Won/lost" },
    ],
  },
  {
    title: "Settings",
    items: [
      { key: "view_pricing", label: "View pricing" },
      { key: "use_cost_calculator", label: "Cost calculator" },
      { key: "manage_pricing_rates", label: "Manage pricing rates" },
      { key: "view_settings", label: "View settings" },
      { key: "manage_whatsapp_config", label: "Manage workspace WhatsApp" },
      { key: "view_team", label: "View team" },
      { key: "manage_team_members", label: "Manage members" },
      { key: "edit_team_permissions", label: "Edit permissions" },
    ],
  },
];

export default function TeamPage() {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [newMemberPermissions, setNewMemberPermissions] = useState<WorkspacePermissions>(
    defaultPermissionsForRole("agent"),
  );
  const [newCanConnectOwnWhatsapp, setNewCanConnectOwnWhatsapp] = useState(false);

  async function loadTeam() {
    setLoading(true);
    const res = await fetch("/api/team/members");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Failed to load team");
      return;
    }
    setData(payload as TeamResponse);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/members")
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load team");
        return payload as TeamResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
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

  async function addMember() {
    const res = await fetch("/api/team/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        role,
        permissions: newMemberPermissions,
        can_connect_own_whatsapp: newCanConnectOwnWhatsapp,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error ?? "Failed to add member");
      return;
    }
    toast.success("Team member added");
    setEmail("");
    setNewMemberPermissions(defaultPermissionsForRole(role));
    setNewCanConnectOwnWhatsapp(false);
    await loadTeam();
  }

  async function updateMember(id: string, update: Record<string, unknown>) {
    const res = await fetch(`/api/team/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error ?? "Failed to update member");
      return;
    }
    toast.success("Member updated");
    await loadTeam();
  }

  const activeMembers = useMemo(
    () => data?.members.filter((member) => member.status === "active") ?? [],
    [data?.members],
  );

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
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-white">Add approved user</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="approved-user@example.com"
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
            <Button onClick={addMember} disabled={!email.trim()} className="bg-violet-600 text-white hover:bg-violet-700">
              Add
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The user must already be signed up and approved before they can be added.
          </p>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <PermissionEditor
              permissions={newMemberPermissions}
              disabled={false}
              canConnectOwnWhatsapp={newCanConnectOwnWhatsapp}
              onToggle={(permission, checked) =>
                setNewMemberPermissions((prev) => ({ ...prev, [permission]: checked }))
              }
              onToggleOwnWhatsapp={setNewCanConnectOwnWhatsapp}
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Members and workload</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading team...</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {data?.members.map((member) => (
              <div key={member.id} className="space-y-3 px-4 py-3">
                <div className="grid gap-3 md:grid-cols-[1fr_130px_130px_120px_120px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {member.full_name || member.email || member.user_id}
                    {member.user_id === data.current_user_id ? " (you)" : ""}
                  </p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
                <select
                  value={member.role}
                  onChange={(e) => updateMember(member.id, { role: e.target.value })}
                  disabled={!data.can_manage_team || member.role === "owner"}
                  className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white disabled:opacity-60"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="agent">Agent</option>
                </select>
                <select
                  value={member.status}
                  onChange={(e) => updateMember(member.id, { status: e.target.value })}
                  disabled={!data.can_manage_team || member.role === "owner"}
                  className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white disabled:opacity-60"
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                </select>
                <span className="text-xs text-slate-400">
                  {member.open_conversations ?? 0} conversations
                </span>
                <span className="text-xs text-slate-400">
                  {member.assigned_deals ?? 0} deals
                </span>
                </div>
                {data.can_manage_team && member.role !== "owner" && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                    <PermissionEditor
                      permissions={effectivePermissions({
                        role: member.role,
                        permissions: member.permissions,
                        can_connect_own_whatsapp: member.can_connect_own_whatsapp,
                      })}
                      disabled={!data.can_manage_team}
                      canConnectOwnWhatsapp={Boolean(member.can_connect_own_whatsapp)}
                      onToggle={(permission, checked) =>
                        updateMember(member.id, {
                          permissions: {
                            ...effectivePermissions({
                              role: member.role,
                              permissions: member.permissions,
                              can_connect_own_whatsapp: member.can_connect_own_whatsapp,
                            }),
                            [permission]: checked,
                          },
                        })
                      }
                      onToggleOwnWhatsapp={(checked) =>
                        updateMember(member.id, { can_connect_own_whatsapp: checked })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionEditor({
  permissions,
  disabled,
  canConnectOwnWhatsapp,
  onToggle,
  onToggleOwnWhatsapp,
}: {
  permissions: WorkspacePermissions;
  disabled: boolean;
  canConnectOwnWhatsapp: boolean;
  onToggle: (permission: WorkspacePermission, checked: boolean) => void;
  onToggleOwnWhatsapp: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <label
                  key={item.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={permissions[item.key] === true}
                    disabled={disabled}
                    onChange={(event) => onToggle(item.key, event.target.checked)}
                    className="size-3 accent-violet-600"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        <input
          type="checkbox"
          checked={canConnectOwnWhatsapp}
          disabled={disabled}
          onChange={(event) => onToggleOwnWhatsapp(event.target.checked)}
          className="size-3 accent-amber-500"
        />
        Allow this member to connect their own WhatsApp API
      </label>
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
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4 text-violet-400" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
