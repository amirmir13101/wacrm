'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, ContactNote, CustomField, ContactCustomValue, Deal } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Save,
  X,
  DollarSign,
} from 'lucide-react';
import {
  isDuplicatePhoneError,
  normalizePhoneForComparison,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp/phone-utils';
import {
  buildManualConsentUpdate,
  getContactConsentStatus,
  OPT_IN_SOURCES,
  OPT_OUT_REASONS,
} from '@/lib/contacts/consent';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

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

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editWhatsappOptIn, setEditWhatsappOptIn] = useState(false);
  const [editOptInSource, setEditOptInSource] = useState('Manual');
  const [editOptedOut, setEditOptedOut] = useState(false);
  const [editOptOutReason, setEditOptOutReason] = useState('Admin action');
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
      setEditWhatsappOptIn(data.whatsapp_opt_in === true);
      setEditOptInSource(data.opt_in_source ?? 'Manual');
      setEditOptedOut(Boolean(data.opted_out_at));
      setEditOptOutReason(data.opt_out_reason ?? 'Admin action');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSavingDetails(true);
    try {
      const normalizedPhone = normalizeWhatsAppPhone(editPhone).phone;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = contact?.user_id ?? session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: existingContacts, error: duplicateLookupError } = await supabase
        .from('contacts')
        .select('id, phone')
        .eq('user_id', userId);

      if (duplicateLookupError) throw duplicateLookupError;

      const duplicate = existingContacts?.find(
        (existing) =>
          existing.id !== contactId &&
          normalizePhoneForComparison(existing.phone) === normalizedPhone,
      );

      if (duplicate) {
        throw new Error('A contact with this phone number already exists.');
      }

      const consentUpdate = buildManualConsentUpdate({
        whatsappOptIn: editWhatsappOptIn,
        optInSource: editOptInSource,
        optedOut: editOptedOut,
        optOutReason: editOptOutReason,
        previousOptedInAt: contact?.opted_in_at,
        previousOptedOutAt: contact?.opted_out_at,
      });

      const { error } = await supabase
        .from('contacts')
        .update({
          name: editName.trim() || null,
          phone: normalizedPhone,
          email: editEmail.trim() || null,
          company: editCompany.trim() || null,
          ...consentUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (error) {
        if (isDuplicatePhoneError(error)) {
          throw new Error('A contact with this phone number already exists.');
        }
        throw error;
      }

      toast.success('Contact updated');
      fetchContact();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setSavingDetails(false);
    }
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);
    try {
      const response = await fetch(`/api/contacts/${contactId}/tags`, {
        method: isSelected ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Failed to update tags');
      setContactTagIds(body.tag_ids ?? []);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tags');
    } finally {
      setSavingTags(false);
    }
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not authenticated');
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error('Failed to add note');
    } else {
      setNewNote('');
      fetchNotes();
      toast.success('Note added');
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Failed to delete note');
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Note deleted');
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      // Delete existing values and re-insert
      await supabase
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', contactId);

      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('contact_custom_values')
          .insert(rows);
        if (error) throw error;
      }

      toast.success('Custom fields saved');
    } catch {
      toast.error('Failed to save custom fields');
    }
    setSavingCustom(false);
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 bg-slate-800 border border-slate-700">
                  <AvatarFallback className="bg-violet-500/10 text-violet-400 text-sm font-medium">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-white truncate">
                    {contact.name || 'Unknown'}
                  </SheetTitle>
                  <SheetDescription className="text-slate-400 text-xs mt-0.5">
                    Contact details
                  </SheetDescription>
                  <div className="mt-1">
                    <ConsentBadge contact={contact} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <button
                      onClick={copyPhone}
                      className="flex items-center gap-1 hover:text-violet-400 transition-colors cursor-pointer"
                    >
                      <Phone className="size-3" />
                      {contact.phone}
                      {copiedPhone ? (
                        <Check className="size-3 text-violet-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {contact.company}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-slate-800/50 border-b border-slate-700 mx-4 mt-3">
                <TabsTrigger
                  value="details"
                  className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="tags"
                  className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
                >
                  Tags
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger
                  value="custom"
                  className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
                >
                  Custom Fields
                </TabsTrigger>
                <TabsTrigger
                  value="deals"
                  className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
                >
                  Deals
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">
                      Phone <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Email</Label>
                    <Input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Company</Label>
                    <Input
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-start gap-2">
                      <input
                        id="detail-whatsapp-opt-in"
                        type="checkbox"
                        checked={editWhatsappOptIn}
                        onChange={(e) => {
                          setEditWhatsappOptIn(e.target.checked);
                          if (e.target.checked) setEditOptedOut(false);
                        }}
                        className="mt-1 size-4 rounded border-slate-700 bg-slate-800 accent-violet-600"
                      />
                      <div>
                        <Label htmlFor="detail-whatsapp-opt-in" className="text-sm text-slate-200">
                          This contact has agreed to receive WhatsApp messages
                        </Label>
                        <p className="text-xs text-slate-500">
                          Required for broadcasts and marketing-style automated follow-ups.
                        </p>
                      </div>
                    </div>

                    {editWhatsappOptIn && !editOptedOut && (
                      <div className="space-y-1.5">
                        <Label htmlFor="detail-opt-in-source" className="text-xs text-slate-400">
                          Opt-in source
                        </Label>
                        <select
                          id="detail-opt-in-source"
                          value={editOptInSource}
                          onChange={(e) => setEditOptInSource(e.target.value)}
                          className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none focus:border-violet-500"
                        >
                          {OPT_IN_SOURCES.map((source) => (
                            <option key={source} value={source}>
                              {source}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <input
                        id="detail-opted-out"
                        type="checkbox"
                        checked={editOptedOut}
                        onChange={(e) => {
                          setEditOptedOut(e.target.checked);
                          if (e.target.checked) setEditWhatsappOptIn(false);
                        }}
                        className="mt-1 size-4 rounded border-slate-700 bg-slate-800 accent-red-600"
                      />
                      <Label htmlFor="detail-opted-out" className="text-sm text-slate-200">
                        Mark contact as opted out
                      </Label>
                    </div>

                    {editOptedOut && (
                      <div className="space-y-1.5">
                        <Label htmlFor="detail-opt-out-reason" className="text-xs text-slate-400">
                          Opt-out reason
                        </Label>
                        <select
                          id="detail-opt-out-reason"
                          value={editOptOutReason}
                          onChange={(e) => setEditOptOutReason(e.target.value)}
                          className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none focus:border-violet-500"
                        >
                          {OPT_OUT_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={saveDetails}
                    disabled={savingDetails}
                    className="bg-violet-600 hover:bg-violet-700 text-white w-full"
                    size="sm"
                  >
                    {savingDetails ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </TabsContent>

              {/* Tags Tab */}
              <TabsContent value="tags" className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Click a tag to add or remove it from this contact.
                  </p>
                  {allTags.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No tags available. Create tags in Settings.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={savingTags}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                              selected
                                ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-900'
                                : 'opacity-50 hover:opacity-80'
                            }`}
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {selected && <Check className="size-3 mr-1" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="flex-1 flex flex-col min-h-0 px-4 py-3">
                <div className="space-y-2 mb-3">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write a note..."
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[60px] text-sm resize-none"
                  />
                  <Button
                    onClick={addNote}
                    disabled={!newNote.trim() || savingNote}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    size="sm"
                  >
                    {savingNote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Add Note
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {loadingNotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-slate-500" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No notes yet.
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-slate-300 whitespace-pre-wrap flex-1">
                            {note.note_text}
                          </p>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          {new Date(note.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              <TabsContent value="custom" className="flex-1 overflow-y-auto px-4 py-3">
                {loadingCustom ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-slate-500" />
                  </div>
                ) : customFields.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No custom fields defined. Create them in Settings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <Label className="text-slate-400 text-xs capitalize">
                          {field.field_name}
                        </Label>
                        <Input
                          value={customValues[field.id] ?? ''}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.field_name}...`}
                          className="bg-slate-800 border-slate-700 text-white h-8 text-sm placeholder:text-slate-500"
                        />
                      </div>
                    ))}
                    <Button
                      onClick={saveCustomFields}
                      disabled={savingCustom}
                      className="bg-violet-600 hover:bg-violet-700 text-white w-full"
                      size="sm"
                    >
                      {savingCustom ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      Save Custom Fields
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="flex-1 overflow-y-auto px-4 py-3">
                {loadingDeals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-violet-500" />
                  </div>
                ) : deals.length === 0 ? (
                  <p className="text-xs text-slate-500">No deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-white">
                            {deal.title}
                          </p>
                          {deal.stage && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${deal.stage.color}20`,
                                color: deal.stage.color,
                              }}
                            >
                              {deal.stage.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <DollarSign className="size-3" />
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency || 'USD',
                              maximumFractionDigits: 0,
                            }).format(Number(deal.value || 0))}
                          </span>
                          {deal.status && deal.status !== 'open' && (
                            <span
                              className={
                                deal.status === 'won'
                                  ? 'text-violet-400'
                                  : 'text-red-400'
                              }
                            >
                              {deal.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
