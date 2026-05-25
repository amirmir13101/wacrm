"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceMemberOption } from "@/lib/team/assignment";
import {
  defaultPermissionsForRole,
  effectivePermissions,
  type WorkspacePermission,
  type WorkspacePermissions,
} from "@/lib/team/permissions";
import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  applyPermissionPreset,
  enabledCount,
  setGroupPermissions,
} from "@/lib/team/permission-ui";

interface TeamResponse {
  workspace_id: string;
  current_user_id: string;
  current_role: string;
  current_permissions?: WorkspacePermissions;
  can_manage_team: boolean;
  members: WorkspaceMemberOption[];
}

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
              onSetPermissions={setNewMemberPermissions}
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
                      onSetPermissions={(permissions) =>
                        updateMember(member.id, { permissions })
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    inbox: true,
    contacts: true,
  });

  function applyPreset(presetId: string) {
    const preset = applyPermissionPreset(presetId);
    onSetPermissions(preset.permissions);
    onToggleOwnWhatsapp(preset.canConnectOwnWhatsapp);
  }

  function setGroup(groupId: string, enabled: boolean) {
    const group = PERMISSION_GROUPS.find((item) => item.id === groupId);
    if (!group) return;
    const next = setGroupPermissions(permissions, group, enabled);
    onSetPermissions(next);
    if (group.id === "whatsapp") {
      onToggleOwnWhatsapp(Boolean(next.connect_own_whatsapp_config));
    }
  }

  return (
    <div className="space-y-4" data-testid="permission-editor">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="size-4 text-violet-300" />
              Role presets
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Start with a preset, then fine-tune permissions below.
            </p>
          </div>
          {ROLE_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              title={preset.helper}
              onClick={() => applyPreset(preset.id)}
              className="border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div
            key={group.id}
            className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80"
          >
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-800/70"
              aria-expanded={openGroups[group.id] === true}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{group.title}</p>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                    {enabledCount(permissions, group)} of {group.items.length} enabled
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{group.helper}</p>
              </div>
              <ChevronDown
                className={`size-4 text-slate-500 transition-transform ${
                  openGroups[group.id] ? "rotate-180" : ""
                }`}
              />
            </button>
            {openGroups[group.id] && (
              <div className="border-t border-slate-800 px-3 py-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setGroup(group.id, true)}
                    className="h-7 px-2 text-xs text-violet-200 hover:bg-violet-500/10"
                  >
                    Select group
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setGroup(group.id, false)}
                    className="h-7 px-2 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Clear group
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <label
                  key={item.key}
                      className={`flex min-h-10 items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
                        item.danger
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
                          : "border-slate-800 bg-slate-950/50 text-slate-300"
                      }`}
                >
                  <input
                    type="checkbox"
                    checked={permissions[item.key] === true}
                    disabled={disabled}
                        onChange={(event) => {
                          onToggle(item.key, event.target.checked);
                          if (item.key === "connect_own_whatsapp_config") {
                            onToggleOwnWhatsapp(event.target.checked);
                          }
                        }}
                    className="size-3 accent-violet-600"
                  />
                      <span>{item.label}</span>
                      {item.danger && (
                        <AlertTriangle className="ml-auto size-3 text-amber-300" />
                      )}
                </label>
              ))}
                </div>
              </div>
            )}
          </div>
        ))}
            </div>
      <label className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        <input
          type="checkbox"
          checked={canConnectOwnWhatsapp}
          disabled={disabled}
          onChange={(event) => {
            onToggleOwnWhatsapp(event.target.checked);
            onToggle("connect_own_whatsapp_config", event.target.checked);
          }}
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
