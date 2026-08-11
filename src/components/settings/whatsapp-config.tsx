'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;
type SetupMode = 'connect' | 'manual';

type EmbeddedSignupConfig = {
  configured: boolean;
  appId?: string;
  configId?: string;
  graphApiVersion: string;
  missing?: string[];
  message?: string;
};

type EmbeddedSignupMessage = {
  type?: string;
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
  };
};

type FacebookLoginResponse = {
  authResponse?: { code?: string | null } | null;
  status?: string;
  error?: { message?: string } | string;
  error_message?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppConfig() {
  const { user, loading: authLoading } = useAuth();
  const workspace = useWorkspacePermissions();
  const canManageConfig =
    workspace.has('manage_whatsapp_config') || workspace.has('connect_own_whatsapp_config');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [setupMode, setSetupMode] = useState<SetupMode>('connect');
  const [embeddedSignupConfig, setEmbeddedSignupConfig] =
    useState<EmbeddedSignupConfig | null>(null);
  const [connectingWithMeta, setConnectingWithMeta] = useState(false);
  const [embeddedSignupError, setEmbeddedSignupError] = useState('');
  const [embeddedSignupIds, setEmbeddedSignupIds] = useState<{
    phone_number_id?: string;
    waba_id?: string;
  }>({});
  const embeddedSignupIdsRef = useRef<{
    phone_number_id?: string;
    waba_id?: string;
  }>({});

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const loadEmbeddedSignupConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/embedded-signup/config', { method: 'GET' });
      const payload = (await res.json().catch(() => ({}))) as EmbeddedSignupConfig & {
        error?: string;
      };
      if (!res.ok) {
        setEmbeddedSignupConfig(null);
        setEmbeddedSignupError(payload.error || 'Unable to load Embedded Signup settings.');
        return null;
      }
      setEmbeddedSignupConfig(payload);
      setEmbeddedSignupError(payload.configured ? '' : payload.message || '');
      return payload;
    } catch (err) {
      console.error('Embedded Signup config error:', err);
      setEmbeddedSignupConfig(null);
      setEmbeddedSignupError('Unable to load Embedded Signup settings.');
      return null;
    }
  }, []);

  const loadFacebookSdk = useCallback((appId: string, graphApiVersion: string) => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Embedded Signup must be started in a browser.'));
        return;
      }

      if (window.FB) {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: graphApiVersion,
        });
        resolve();
        return;
      }

      window.fbAsyncInit = () => {
        window.FB?.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: graphApiVersion,
        });
        resolve();
      };

      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        const timeout = window.setTimeout(() => {
          if (window.FB) {
            window.FB.init({
              appId,
              autoLogAppEvents: true,
              xfbml: true,
              version: graphApiVersion,
            });
            resolve();
          } else {
            reject(new Error('Meta SDK did not finish loading.'));
          }
        }, 8000);
        existingScript.addEventListener(
          'load',
          () => {
            window.clearTimeout(timeout);
            window.FB?.init({
              appId,
              autoLogAppEvents: true,
              xfbml: true,
              version: graphApiVersion,
            });
            resolve();
          },
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => reject(new Error('Failed to load the Meta SDK.'));
      document.body.appendChild(script);
    });
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json().catch(() => ({}));

      if (!canManageConfig) {
        setConfig(null);
        setConnectionStatus(payload.connected ? 'connected' : 'disconnected');
        setResetReason(null);
        setStatusMessage(payload.message || 'Workspace WhatsApp is managed by the owner.');
        setLoading(false);
        return;
      }

      const safeConfig = payload.config as Partial<WhatsAppConfigType> | undefined;
      if (safeConfig?.phone_number_id) {
        setConfig(safeConfig as WhatsAppConfigType);
        setPhoneNumberId(safeConfig.phone_number_id || '');
        setWabaId(safeConfig.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setTokenEdited(false);
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
      }

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [canManageConfig]);

  useEffect(() => {
    if (authLoading || workspace.loading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchConfig();
    loadEmbeddedSignupConfig();
  }, [authLoading, workspace.loading, user, fetchConfig, loadEmbeddedSignupConfig]);

  useEffect(() => {
    function handleEmbeddedSignupMessage(event: MessageEvent) {
      let originHost = '';
      try {
        originHost = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (originHost !== 'facebook.com' && !originHost.endsWith('.facebook.com')) return;

      let payload: EmbeddedSignupMessage | null = null;
      if (typeof event.data === 'string') {
        try {
          payload = JSON.parse(event.data) as EmbeddedSignupMessage;
        } catch {
          return;
        }
      } else if (typeof event.data === 'object' && event.data !== null) {
        payload = event.data as EmbeddedSignupMessage;
      }

      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
        const ids = {
          phone_number_id: payload.data?.phone_number_id,
          waba_id: payload.data?.waba_id,
        };
        embeddedSignupIdsRef.current = ids;
        setEmbeddedSignupIds(ids);
      }
    }

    window.addEventListener('message', handleEmbeddedSignupMessage);
    return () => window.removeEventListener('message', handleEmbeddedSignupMessage);
  }, []);

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      // Always POST through the API — it verifies with Meta and encrypts
      // the access_token server-side with ENCRYPTION_KEY. Skipping this
      // and writing direct to Supabase stores the token in plaintext,
      // which then fails decryption on every subsequent health check.
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        // Existing config — reuse stored encrypted token by decrypting on the
        // server. But our POST handler requires an access_token to verify
        // with Meta. If the user didn't change the token, we need to signal
        // that. Simplest: require token re-entry if they're updating.
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'Configuration saved successfully'
      );

      if (user) await fetchConfig();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config?verify=1', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  async function handleEmbeddedSignupLoginResponse(response: FacebookLoginResponse) {
    try {
      const metaError =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || response.error_message || '';
      if (metaError) {
        setEmbeddedSignupError(metaError);
        toast.error(metaError);
        return;
      }

      const code = response.authResponse?.code;
      const phoneNumberId = embeddedSignupIdsRef.current.phone_number_id;
      const embeddedWabaId = embeddedSignupIdsRef.current.waba_id;

      if (!code) {
        const cancelled = response.status && response.status !== 'connected';
        const message = cancelled
          ? 'Connection cancelled.'
          : 'Meta signup did not return an authorization code.';
        setEmbeddedSignupError(message);
        toast.error(message);
        return;
      }

      if (!phoneNumberId) {
        setEmbeddedSignupError(
          'Meta signup did not return a phone number ID. Please complete all WhatsApp setup steps and try again.',
        );
        toast.error('WhatsApp phone number was not returned by Meta');
        return;
      }

      const res = await fetch('/api/whatsapp/embedded-signup/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          phone_number_id: phoneNumberId,
          waba_id: embeddedWabaId,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEmbeddedSignupError(data.error || 'Failed to save WhatsApp connection.');
        toast.error(data.error || 'Failed to save WhatsApp connection');
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'WhatsApp connected successfully',
      );
      await fetchConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finish WhatsApp connection.';
      setEmbeddedSignupError(message);
      toast.error(message);
    } finally {
      setConnectingWithMeta(false);
    }
  }

  async function handleConnectWithWhatsApp() {
    setEmbeddedSignupError('');
    setConnectingWithMeta(true);

    try {
      const metaConfig = embeddedSignupConfig ?? (await loadEmbeddedSignupConfig());
      if (!metaConfig?.configured || !metaConfig.appId || !metaConfig.configId) {
        const missing = metaConfig?.missing?.length
          ? ` Missing server settings: ${metaConfig.missing.join(', ')}.`
          : '';
        const message =
          `Meta Embedded Signup is not configured for this CRM installation.${missing}`;
        setEmbeddedSignupError(message);
        toast.error('Meta Embedded Signup is not configured');
        setConnectingWithMeta(false);
        return;
      }

      await loadFacebookSdk(metaConfig.appId, metaConfig.graphApiVersion);

      if (!window.FB) {
        throw new Error('Meta SDK was not available after loading.');
      }

      window.FB.login(
        function handleFacebookLoginCallback(response) {
          void handleEmbeddedSignupLoginResponse(response);
        },
        {
          config_id: metaConfig.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
          },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start WhatsApp connection.';
      setEmbeddedSignupError(message);
      toast.error(message);
      setConnectingWithMeta(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  if (!canManageConfig) {
    return (
      <div className="mt-4 max-w-3xl space-y-4">
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-violet-500" />
            ) : (
              <XCircle className="size-4 text-amber-500" />
            )}
            <AlertTitle className="text-white mb-0">
              Workspace WhatsApp is managed by the owner
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected'
              ? 'Your replies use the workspace WhatsApp connection. API credentials are hidden from team members.'
              : statusMessage ||
                'The workspace owner needs to connect WhatsApp before messaging is available.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">
                  Stored token can&apos;t be decrypted
                </AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Reset Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection Status */}
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-violet-500" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <AlertTitle className="text-white mb-0">
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected'
              ? 'Your WhatsApp Business API is connected and ready to send/receive messages.'
              : statusMessage ||
                'Configure your Meta API credentials below to connect your WhatsApp Business account.'}
          </AlertDescription>
        </Alert>

        {/* Setup Mode */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSetupMode('connect')}
            className={`rounded-2xl border p-4 text-left transition ${
              setupMode === 'connect'
                ? 'border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
                : 'border-slate-700 bg-slate-900 hover:border-emerald-400/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <MessageCircle className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-white">Connect WhatsApp</p>
                <p className="text-sm text-slate-400">Official Meta Embedded Signup flow.</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSetupMode('manual')}
            className={`rounded-2xl border p-4 text-left transition ${
              setupMode === 'manual'
                ? 'border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
                : 'border-slate-700 bg-slate-900 hover:border-emerald-400/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-white">Manual Setup</p>
                <p className="text-sm text-slate-400">Paste your existing Meta API credentials.</p>
              </div>
            </div>
          </button>
        </div>

        {setupMode === 'connect' ? (
          <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
            <CardHeader>
              <CardTitle className="text-white">Connect with Meta Embedded Signup</CardTitle>
              <CardDescription className="text-slate-400">
                Use Meta&apos;s official Facebook Login for Business flow to connect a WhatsApp
                Business Account and phone number without manually pasting API credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="font-semibold text-white">Secure official setup</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Talk Wagon starts Meta&apos;s official Embedded Signup popup. The temporary
                      authorization code is exchanged on the server, and tokens are encrypted before
                      storage. App secrets and access tokens are never exposed in the browser.
                    </p>
                  </div>
                </div>
              </div>

              {!embeddedSignupConfig?.configured && embeddedSignupConfig?.missing?.length ? (
                <Alert className="border-amber-600/40 bg-amber-950/40">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <AlertTitle className="text-amber-200">
                    Embedded Signup is not configured
                  </AlertTitle>
                  <AlertDescription className="text-amber-100/80">
                    Ask the server admin to set{' '}
                    <span className="font-mono">META_APP_ID</span>,{' '}
                    <span className="font-mono">META_EMBEDDED_SIGNUP_CONFIG_ID</span>, and{' '}
                    <span className="font-mono">META_APP_SECRET</span>. You can still use Manual
                    Setup below.
                  </AlertDescription>
                </Alert>
              ) : null}

              {embeddedSignupError ? (
                <Alert className="border-red-900/50 bg-red-950/30">
                  <XCircle className="size-4 text-red-400" />
                  <AlertTitle className="text-red-200">Connection not completed</AlertTitle>
                  <AlertDescription className="text-red-100/80">
                    {embeddedSignupError}
                  </AlertDescription>
                </Alert>
              ) : null}

              {embeddedSignupIds.phone_number_id || embeddedSignupIds.waba_id ? (
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
                  Meta returned setup details. Saving completes after the authorization code is
                  exchanged server-side.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleConnectWithWhatsApp}
                  disabled={connectingWithMeta}
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  {connectingWithMeta ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="size-4" />
                      Connect with WhatsApp
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSetupMode('manual')}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Use Manual Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
        {/* API Credentials */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">API Credentials</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your Meta WhatsApp Business API credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Phone Number ID</Label>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">WhatsApp Business Account ID</Label>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Permanent Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setTokenEdited(true);
                  }}
                  onFocus={() => {
                    if (accessToken === MASKED_TOKEN) {
                      setAccessToken('');
                      setTokenEdited(true);
                    }
                  }}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {config && !tokenEdited && (
                <p className="text-xs text-slate-500">
                  Token is hidden for security. Re-enter it to update configuration.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Verify Token</Label>
              <Input
                placeholder="Create a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                A custom string you create. Must match the token you set in Meta webhook settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">Webhook Configuration</CardTitle>
            <CardDescription className="text-slate-400">
              Use this URL as your webhook callback in the Meta App Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {testing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Test API Connection
              </>
            )}
          </Button>
          {config && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reset Configuration
                </>
              )}
            </Button>
          )}
        </div>
          </>
        )}
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-slate-400">
              Follow these steps to connect your WhatsApp Business API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">1</span>
                    Create a Meta App
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <span className="text-violet-400">developers.facebook.com</span></li>
                    <li>Click &quot;My Apps&quot; and then &quot;Create App&quot;</li>
                    <li>Select &quot;Business&quot; as the app type</li>
                    <li>Fill in app details and create</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">2</span>
                    Add WhatsApp Product
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>In your app dashboard, click &quot;Add Product&quot;</li>
                    <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                    <li>Follow the setup wizard to link your business</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">3</span>
                    Get API Credentials
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; API Setup</li>
                    <li>Copy your <strong className="text-slate-200">Phone Number ID</strong></li>
                    <li>Copy your <strong className="text-slate-200">WhatsApp Business Account ID</strong></li>
                    <li>Generate a <strong className="text-slate-200">Permanent Access Token</strong> from Business Settings &gt; System Users</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">4</span>
                    Configure Webhooks
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; Configuration</li>
                    <li>Click &quot;Edit&quot; on the Webhook section</li>
                    <li>Paste the <strong className="text-slate-200">Webhook Callback URL</strong> from above</li>
                    <li>Enter the same <strong className="text-slate-200">Verify Token</strong> you set here</li>
                    <li>Subscribe to &quot;messages&quot; webhook field</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Meta WhatsApp API Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
