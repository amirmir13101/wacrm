'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { getContactConsentStatus } from '@/lib/contacts/consent';

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

interface ContactsResponse {
  contacts: ContactWithTags[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

type DeleteMode = 'single' | 'bulk';

function ConsentBadge({ contact }: { contact: Contact }) {
  const status = getContactConsentStatus(contact);
  const styles = {
    opted_in: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    opted_out: 'border-red-500/30 bg-red-500/10 text-red-300',
    not_opted_in: 'border-slate-700 bg-slate-800 text-slate-400',
  }[status];
  const label = {
    opted_in: 'Opted in',
    opted_out: 'Opted out',
    not_opted_in: 'Not opted in',
  }[status];

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`}>
      {label}
    </span>
  );
}

function parsePageParam(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSizeParam(value: string | null) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(parsePageParam(searchParams.get('page')));
  const [pageSize, setPageSize] = useState(parsePageSizeParam(searchParams.get('pageSize')));
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('single');
  const [deleteTargets, setDeleteTargets] = useState<ContactWithTags[]>([]);
  const [deleting, setDeleting] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);

  const updateUrl = useCallback((next: { page?: number; pageSize?: number; search?: string }) => {
    const nextPage = next.page ?? page;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextSearch = next.search ?? search;
    const params = new URLSearchParams();

    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextPageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(nextPageSize));
    if (nextSearch.trim()) params.set('search', nextSearch.trim());

    const query = params.toString();
    router.replace(query ? `/contacts?${query}` : '/contacts', { scroll: false });
  }, [page, pageSize, router, search]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) params.set('search', search.trim());

    try {
      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as ContactsResponse;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load contacts');
      }
      setContacts(payload.contacts ?? []);
      setTotalCount(payload.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contacts');
      setContacts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    const nextPage = parsePageParam(searchParams.get('page'));
    const nextPageSize = parsePageSizeParam(searchParams.get('pageSize'));
    const nextSearch = searchParams.get('search') ?? '';

    setPage(nextPage);
    setPageSize(nextPageSize);
    setSearch(nextSearch);
    setSelectedIds(new Set());
  }, [searchParams]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedIds.size > 0 && selectedIds.size < contacts.length;
  }, [contacts.length, selectedIds]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function toggleContactSelection(contactId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleSelectVisible(checked: boolean) {
    setSelectedIds(checked ? new Set(contacts.map((contact) => contact.id)) : new Set());
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setSelectedIds(new Set());
    updateUrl({ page: nextPage });
  }

  function changePageSize(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
    setSelectedIds(new Set());
    updateUrl({ page: 1, pageSize: nextPageSize });
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    setPage(1);
    setSelectedIds(new Set());
    updateUrl({ page: 1, search: nextSearch });
  }

  function confirmDelete(contact: ContactWithTags) {
    setDeleteMode('single');
    setDeleteTargets([contact]);
    setDeleteConfirmOpen(true);
  }

  function confirmBulkDelete() {
    const selected = contacts.filter((contact) => selectedIds.has(contact.id));
    if (selected.length === 0) return;
    setDeleteMode('bulk');
    setDeleteTargets(selected);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (deleteTargets.length === 0) return;
    setDeleting(true);

    try {
      const response = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deleteTargets.map((contact) => contact.id) }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        deleted_count?: number;
        deleted_ids?: string[];
      };
      if (!response.ok) throw new Error(payload.error || 'Failed to delete contacts');

      const deletedIds = new Set(payload.deleted_ids ?? []);
      const deletedOnPage = contacts.filter((contact) => deletedIds.has(contact.id)).length;
      setContacts((current) => current.filter((contact) => !deletedIds.has(contact.id)));
      setTotalCount((current) => Math.max(0, current - (payload.deleted_count ?? deletedOnPage)));
      setSelectedIds(new Set());
      toast.success(
        deleteMode === 'bulk'
          ? `${payload.deleted_count ?? deletedOnPage} selected contacts deleted`
          : 'Contact deleted',
      );

      const remainingOnPage = contacts.length - deletedOnPage;
      if (remainingOnPage <= 0 && page > 1) {
        changePage(page - 1);
      } else {
        await fetchContacts();
      }
      setDeleteConfirmOpen(false);
      setDeleteTargets([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contacts');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + contacts.length, totalCount);
  const allVisibleSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const deleteTitle = deleteMode === 'bulk' ? 'Delete Selected Contacts' : 'Delete Contact';
  const deleteDescription =
    deleteMode === 'bulk'
      ? `Delete ${deleteTargets.length} selected contacts? This action cannot be undone.`
      : `Are you sure you want to delete ${deleteTargets[0]?.name || deleteTargets[0]?.phone}? This action cannot be undone.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your contact list. {totalCount > 0 && `${totalCount} total contacts.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Upload className="size-4" />
            Import
          </Button>
          <Button
            onClick={openAddForm}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <Plus className="size-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            placeholder="Search by name, phone, email, or company..."
            className="border-slate-700 bg-slate-900 pl-8 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-xs text-slate-500">
            Showing {rangeStart}-{rangeEnd} of {totalCount} contacts
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none hover:bg-slate-800"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex min-h-9 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Select All applies to the visible page only. Selection clears when the page, search, or page size changes.
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedIds.size === 0 || deleting}
          onClick={confirmBulkDelete}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete Selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="w-10 text-slate-400">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all visible contacts"
                  checked={allVisibleSelected}
                  disabled={contacts.length === 0}
                  onChange={(e) => toggleSelectVisible(e.target.checked)}
                  className="size-4 rounded border-slate-700 bg-slate-900 accent-violet-600"
                />
              </TableHead>
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400">Phone</TableHead>
              <TableHead className="hidden text-slate-400 md:table-cell">Email</TableHead>
              <TableHead className="hidden text-slate-400 lg:table-cell">Company</TableHead>
              <TableHead className="hidden text-slate-400 md:table-cell">Consent</TableHead>
              <TableHead className="hidden text-slate-400 md:table-cell">Tags</TableHead>
              <TableHead className="hidden text-slate-400 lg:table-cell">Created</TableHead>
              <TableHead className="w-12 text-slate-400" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-violet-500" />
                    <p className="text-sm text-slate-500">Loading contacts...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-slate-600" />
                    <p className="text-sm text-slate-500">
                      {search ? 'No contacts match your search.' : 'No contacts yet.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        <Plus className="size-3.5" />
                        Add your first contact
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer border-slate-800 hover:bg-slate-900/50"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${contact.name || contact.phone}`}
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                      className="size-4 rounded border-slate-700 bg-slate-900 accent-violet-600"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-white">
                    {contact.name || <span className="text-slate-500 italic">Unnamed</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-400 md:table-cell">
                    {contact.email || <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-400 lg:table-cell">
                    {contact.company || <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ConsentBadge contact={contact} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600">-</span>
                      )}
                      {contact.tags && contact.tags.length > 3 && (
                        <span className="text-[10px] text-slate-500">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-slate-500 lg:table-cell">
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-400 hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="border-slate-700 bg-slate-900"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(contact);
                          }}
                          className="text-slate-300 focus:bg-slate-800 focus:text-white"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(contact);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Showing {rangeStart}-{rangeEnd} of {totalCount} contacts
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasPrev || loading}
            onClick={() => changePage(page - 1)}
            className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasNext || loading}
            onClick={() => changePage(page + 1)}
            className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={fetchContacts}
      />

      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          setPage(1);
          setSelectedIds(new Set());
          updateUrl({ page: 1 });
          void fetchContacts();
        }}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="border-slate-700 bg-slate-900 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{deleteTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {deleteDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-slate-700 bg-slate-900">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
