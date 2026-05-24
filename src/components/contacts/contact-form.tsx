'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  isDuplicatePhoneError,
  normalizePhoneForComparison,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp/phone-utils';
import { buildManualConsentUpdate, OPT_IN_SOURCES, OPT_OUT_REASONS } from '@/lib/contacts/consent';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
}: ContactFormProps) {
  const supabase = createClient();
  const isEdit = !!contact;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [optInSource, setOptInSource] = useState<string>('Manual');
  const [optedOut, setOptedOut] = useState(false);
  const [optOutReason, setOptOutReason] = useState<string>('Admin action');
  const [saving, setSaving] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setWhatsappOptIn(contact?.whatsapp_opt_in === true);
      setOptInSource(contact?.opt_in_source ?? 'Manual');
      setOptedOut(Boolean(contact?.opted_out_at));
      setOptOutReason(contact?.opt_out_reason ?? 'Admin action');
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      fetchTags();
    }
  }, [open, contact]);

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      let contactId = contact?.id;
      const normalizedPhone = normalizeWhatsAppPhone(phone).phone;
      const consentUpdate = buildManualConsentUpdate({
        whatsappOptIn,
        optInSource,
        optedOut,
        optOutReason,
        previousOptedInAt: contact?.opted_in_at,
        previousOptedOutAt: contact?.opted_out_at,
      });

      const { data: existingContacts, error: duplicateLookupError } = await supabase
        .from('contacts')
        .select('id, phone');

      if (duplicateLookupError) throw duplicateLookupError;

      const duplicate = existingContacts?.find(
        (existing) =>
          existing.id !== contactId &&
          normalizePhoneForComparison(existing.phone) === normalizedPhone,
      );

      if (duplicate) {
        throw new Error('A contact with this phone number already exists.');
      }

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: normalizedPhone,
            email: email.trim() || null,
            company: company.trim() || null,
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
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            name: name.trim() || null,
            phone: normalizedPhone,
            email: email.trim() || null,
            company: company.trim() || null,
            ...consentUpdate,
          })
          .select('id')
          .single();
        if (error) {
          if (isDuplicatePhoneError(error)) {
            throw new Error('A contact with this phone number already exists.');
          }
          throw error;
        }
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagRows);
          if (tagError) throw tagError;
        }
      }

      toast.success(isEdit ? 'Contact updated' : 'Contact created');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save contact';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Edit Contact' : 'Add Contact'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEdit
              ? 'Update the contact details below.'
              : 'Fill in the details to create a new contact.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-name" className="text-slate-300">
              Name
            </Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-phone" className="text-slate-300">
              Phone <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              Include country code, e.g. +1 for US
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-email" className="text-slate-300">
              Email
            </Label>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-company" className="text-slate-300">
              Company
            </Label>
            <Input
              id="cf-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Tags</Label>
            {loadingTags ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="size-3 animate-spin" />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tags available. Create tags in Settings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-900'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-start gap-2">
              <input
                id="cf-whatsapp-opt-in"
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => {
                  setWhatsappOptIn(e.target.checked);
                  if (e.target.checked) setOptedOut(false);
                }}
                className="mt-1 size-4 rounded border-slate-700 bg-slate-800 accent-violet-600"
              />
              <div>
                <Label htmlFor="cf-whatsapp-opt-in" className="text-sm text-slate-200">
                  This contact has agreed to receive WhatsApp messages
                </Label>
                <p className="text-xs text-slate-500">
                  Required for broadcasts and marketing-style automated follow-ups.
                </p>
              </div>
            </div>

            {whatsappOptIn && !optedOut && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-opt-in-source" className="text-xs text-slate-400">
                  Opt-in source
                </Label>
                <select
                  id="cf-opt-in-source"
                  value={optInSource}
                  onChange={(e) => setOptInSource(e.target.value)}
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
                id="cf-opted-out"
                type="checkbox"
                checked={optedOut}
                onChange={(e) => {
                  setOptedOut(e.target.checked);
                  if (e.target.checked) setWhatsappOptIn(false);
                }}
                className="mt-1 size-4 rounded border-slate-700 bg-slate-800 accent-red-600"
              />
              <Label htmlFor="cf-opted-out" className="text-sm text-slate-200">
                Mark contact as opted out
              </Label>
            </div>

            {optedOut && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-opt-out-reason" className="text-xs text-slate-400">
                  Opt-out reason
                </Label>
                <select
                  id="cf-opt-out-reason"
                  value={optOutReason}
                  onChange={(e) => setOptOutReason(e.target.value)}
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

          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
