'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, MessageSquare, Tag, User } from 'lucide-react';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions';
import { cn } from '@/lib/utils';

const TAB_VALUES = ['profile', 'whatsapp', 'templates', 'tags'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = useWorkspacePermissions();

  // The URL is the single source of truth for the active tab — no
  // local state, no sync effect. A previous revision duplicated this
  // into `useState` + a sync effect, which tripped React 19's
  // set-state-in-effect rule and was also redundant.
  const queryTab = searchParams.get('tab');
  const availableTabs = {
    profile: true,
    whatsapp:
      workspace.has('manage_whatsapp_config') ||
      workspace.has('connect_own_whatsapp_config') ||
      workspace.has('use_workspace_whatsapp_config'),
    templates: workspace.has('view_templates'),
    tags: workspace.has('edit_contacts') || workspace.has('view_contacts'),
  } satisfies Record<TabValue, boolean>;

  const requestedTab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';
  const tab: TabValue = availableTabs[requestedTab] ? requestedTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const tabs = [
    { value: 'profile', label: 'Profile', icon: User, visible: availableTabs.profile },
    { value: 'whatsapp', label: 'WhatsApp Config', icon: Settings, visible: availableTabs.whatsapp },
    { value: 'templates', label: 'Templates', icon: MessageSquare, visible: availableTabs.templates },
    { value: 'tags', label: 'Tags', icon: Tag, visible: availableTabs.tags },
  ] satisfies Array<{
    value: TabValue;
    label: string;
    icon: typeof User;
    visible: boolean;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, WhatsApp® integration, message templates, and
          tags.
        </p>
      </div>

      <div className="space-y-6">
        <div
          aria-label="Settings sections"
          className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border border-emerald-900/70 bg-emerald-950/40 p-1"
          role="tablist"
        >
          {tabs
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = item.value === tab;

              return (
                <button
                  key={item.value}
                  aria-selected={isActive}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950',
                    isActive
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white',
                  )}
                  onClick={() => onChange(item.value)}
                  role="tab"
                  type="button"
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
        </div>

        {tab === 'profile' && <div className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </div>}

        {availableTabs.whatsapp && tab === 'whatsapp' && (
          <WhatsAppConfig />
        )}

        {availableTabs.templates && tab === 'templates' && (
          <TemplateManager />
        )}

        {availableTabs.tags && tab === 'tags' && (
          <TagManager />
        )}
      </div>
    </div>
  );
}
