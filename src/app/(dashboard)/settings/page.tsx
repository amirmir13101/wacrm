'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calculator, Settings, MessageSquare, Tag, User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { WhatsAppPricingManager } from '@/components/settings/whatsapp-pricing-manager';
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions';

const TAB_VALUES = ['profile', 'whatsapp', 'templates', 'pricing', 'tags'] as const;
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
    pricing: workspace.has('view_pricing') || workspace.has('use_cost_calculator'),
    tags: workspace.has('edit_contacts') || workspace.has('view_contacts'),
  } satisfies Record<TabValue, boolean>;

  const requestedTab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';
  const tab: TabValue = availableTabs[requestedTab] ? requestedTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, WhatsApp® integration, message templates, and
          tags.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => onChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700">
          {availableTabs.profile && <TabsTrigger
            value="profile"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <User className="size-4" />
            Profile
          </TabsTrigger>}
          {availableTabs.whatsapp && <TabsTrigger
            value="whatsapp"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Settings className="size-4" />
            WhatsApp Config
          </TabsTrigger>}
          {availableTabs.templates && <TabsTrigger
            value="templates"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <MessageSquare className="size-4" />
            Templates
          </TabsTrigger>}
          {availableTabs.pricing && <TabsTrigger
            value="pricing"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Calculator className="size-4" />
            Pricing
          </TabsTrigger>}
          {availableTabs.tags && <TabsTrigger
            value="tags"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Tag className="size-4" />
            Tags
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </TabsContent>

        {availableTabs.whatsapp && <TabsContent value="whatsapp">
          <WhatsAppConfig />
        </TabsContent>}

        {availableTabs.templates && <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>}

        {availableTabs.pricing && <TabsContent value="pricing">
          <WhatsAppPricingManager />
        </TabsContent>}

        {availableTabs.tags && <TabsContent value="tags">
          <TagManager />
        </TabsContent>}
      </Tabs>
    </div>
  );
}
