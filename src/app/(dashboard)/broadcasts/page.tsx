'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Radio, Plus, Loader2, Trash2 } from 'lucide-react';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { TrialUsageCard } from '@/components/billing/trial-usage-card';
import { toast } from 'sonner';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;
const ACTIVE_BROADCAST_DELETE_STATUSES = new Set(['queued', 'sending']);

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-violet-500" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right text-xs tabular-nums text-slate-300">
        {pct}%
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([]);
  const [deletingBroadcastIds, setDeletingBroadcastIds] = useState<string[]>([]);

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchBroadcasts() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBroadcasts(data ?? []);
      setSelectedBroadcastIds((current) =>
        current.filter((id) => (data ?? []).some((broadcast) => broadcast.id === id)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );
  const selectedDeletableCount = useMemo(
    () =>
      broadcasts.filter(
        (broadcast) =>
          selectedBroadcastIds.includes(broadcast.id) &&
          !ACTIVE_BROADCAST_DELETE_STATUSES.has(broadcast.status),
      ).length,
    [broadcasts, selectedBroadcastIds],
  );
  const allSelected = broadcasts.length > 0 && selectedBroadcastIds.length === broadcasts.length;

  function toggleSelectBroadcast(id: string) {
    setSelectedBroadcastIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  }

  function toggleSelectAllBroadcasts() {
    setSelectedBroadcastIds(allSelected ? [] : broadcasts.map((broadcast) => broadcast.id));
  }

  async function deleteBroadcasts(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;

    setDeletingBroadcastIds(uniqueIds);
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: uniqueIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete broadcasts');

      const deletedCount = Number(data.deletedCount ?? 0);
      const skippedCount = Number(data.skippedCount ?? 0);
      if (deletedCount > 0) toast.success(`${deletedCount} broadcast${deletedCount === 1 ? '' : 's'} deleted.`);
      if (skippedCount > 0) {
        toast.warning(`${skippedCount} broadcast${skippedCount === 1 ? '' : 's'} skipped because queued/sending broadcasts cannot be deleted.`);
      }
      setSelectedBroadcastIds((current) => current.filter((id) => !uniqueIds.includes(id)));
      await fetchBroadcasts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete broadcasts');
    } finally {
      setDeletingBroadcastIds([]);
    }
  }

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchBroadcasts, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchBroadcasts();
        startPolling();
      }
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anySending && (
        <div
          role="progressbar"
          aria-label="Broadcast in progress"
          className="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-slate-800"
        >
          <div className="broadcast-indeterminate-bar h-0.5 bg-violet-500" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Broadcasts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Send bulk messages to your contacts using approved templates.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="bg-violet-600 text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      <TrialUsageCard compact />

      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
          <Radio className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-white">No broadcasts yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Create your first broadcast to reach your contacts at scale.
          </p>
          <Button
            onClick={() => router.push('/broadcasts/new')}
            className="mt-4 bg-violet-600 text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            New Broadcast
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#3ddf84]/60 bg-slate-900 transition-colors hover:border-[#3ddf84]/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">
              {selectedBroadcastIds.length > 0
                ? `${selectedBroadcastIds.length} selected · ${selectedDeletableCount} can be deleted`
                : 'Select broadcasts to delete completed, failed, cancelled, or sent history.'}
            </p>
            {selectedBroadcastIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={deletingBroadcastIds.length > 0 || selectedDeletableCount === 0}
                onClick={() => deleteBroadcasts(selectedBroadcastIds)}
                className="border-red-500/30 bg-transparent text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                {deletingBroadcastIds.length > 0 ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete selected
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-10 text-slate-400">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAllBroadcasts}
                    aria-label="Select all broadcasts"
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-emerald-400"
                  />
                </TableHead>
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="hidden text-slate-400 md:table-cell">Template</TableHead>
                <TableHead className="hidden text-right text-slate-400 sm:table-cell">
                  Recipients
                </TableHead>
                <TableHead className="hidden text-slate-400 lg:table-cell">Delivery</TableHead>
                <TableHead className="hidden text-slate-400 lg:table-cell">Read</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="hidden text-slate-400 sm:table-cell">Date</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                const isSelected = selectedBroadcastIds.includes(broadcast.id);
                const isActive = ACTIVE_BROADCAST_DELETE_STATUSES.has(broadcast.status);
                const isDeleting = deletingBroadcastIds.includes(broadcast.id);
                return (
                  <TableRow
                    key={broadcast.id}
                    className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                    onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectBroadcast(broadcast.id)}
                        aria-label={`Select broadcast ${broadcast.name}`}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-emerald-400"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-white">
                      {broadcast.name}
                    </TableCell>
                    <TableCell className="hidden text-slate-300 md:table-cell">
                      {broadcast.template_name}
                    </TableCell>
                    <TableCell className="hidden text-right text-slate-300 tabular-nums sm:table-cell">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-violet-500"
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                      >
                        {status.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-slate-400 sm:table-cell">
                      {new Date(broadcast.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={isActive || isDeleting}
                        title={
                          isActive
                            ? 'Cannot delete while queued or sending'
                            : 'Delete this broadcast'
                        }
                        onClick={() => deleteBroadcasts([broadcast.id])}
                        className="text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
