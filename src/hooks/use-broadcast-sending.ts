'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, MessageTemplate, VariableMapping } from '@/types';
import {
  normalizePhoneForComparison,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp/phone-utils';

export type CustomFieldOperator = 'is' | 'is_not' | 'contains';

export interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceConfig {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

interface BroadcastPayload {
  name: string;
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
}

interface UseBroadcastSendingReturn {
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
  progress: number;
}

const INSERT_BATCH_SIZE = 200;

export function useBroadcastSending(): UseBroadcastSendingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  async function resolveAudience(audience: AudienceConfig): Promise<Contact[]> {
    const supabase = createClient();
    let contacts: Contact[] = [];

    if (audience.type === 'all') {
      const { data, error } = await supabase.from('contacts').select('*');
      if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
      contacts = data ?? [];
    } else if (audience.type === 'tags' && audience.tagIds?.length) {
      const { data: contactTags, error: tagError } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.tagIds);
      if (tagError) throw new Error(`Failed to fetch contact tags: ${tagError.message}`);

      const ids = [...new Set((contactTags ?? []).map((ct) => ct.contact_id))];
      if (ids.length > 0) {
        const { data, error } = await supabase.from('contacts').select('*').in('id', ids);
        if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
        contacts = data ?? [];
      }
    } else if (audience.type === 'custom_field' && audience.customField) {
      contacts = await resolveCustomFieldAudience(supabase, audience.customField);
    } else if (audience.type === 'csv' && audience.csvContacts) {
      contacts = await upsertCsvContacts(supabase, audience.csvContacts);
    }

    if (audience.excludeTagIds?.length) {
      const { data: excludeRows } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.excludeTagIds);
      const excludedIds = new Set((excludeRows ?? []).map((r) => r.contact_id));
      contacts = contacts.filter((c) => !excludedIds.has(c.id));
    }

    return contacts;
  }

  async function upsertCsvContacts(
    supabase: ReturnType<typeof createClient>,
    csvRows: { phone: string; name?: string }[],
  ): Promise<Contact[]> {
    if (csvRows.length === 0) return [];

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('You are not signed in.');

    const uniqueByPhone = new Map<string, { phone: string; name?: string }>();
    const invalidRows: string[] = [];
    for (const [index, row] of csvRows.entries()) {
      try {
        const phone = normalizeWhatsAppPhone(row.phone).phone;
        uniqueByPhone.set(phone, { ...row, phone });
      } catch {
        invalidRows.push(`row ${index + 1}`);
      }
    }

    if (invalidRows.length > 0) {
      throw new Error(`CSV contains invalid phone numbers: ${invalidRows.slice(0, 5).join(', ')}`);
    }

    const phones = [...uniqueByPhone.keys()];
    const { data: existing, error: lookupErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id);
    if (lookupErr) throw new Error(`Failed to look up CSV contacts: ${lookupErr.message}`);

    const byPhone = new Map<string, Contact>();
    for (const contact of (existing ?? []) as Contact[]) {
      if (contact.phone) byPhone.set(normalizePhoneForComparison(contact.phone), contact);
    }

    const missing = phones
      .filter((phone) => !byPhone.has(phone))
      .map((phone) => ({
        user_id: user.id,
        phone,
        name: uniqueByPhone.get(phone)?.name ?? null,
        whatsapp_opt_in: false,
      }));

    for (let i = 0; i < missing.length; i += INSERT_BATCH_SIZE) {
      const chunk = missing.slice(i, i + INSERT_BATCH_SIZE);
      const { data: inserted, error: insertErr } = await supabase
        .from('contacts')
        .insert(chunk)
        .select();
      if (insertErr) throw new Error(`Failed to create CSV contacts: ${insertErr.message}`);
      for (const contact of (inserted ?? []) as Contact[]) {
        if (contact.phone) byPhone.set(contact.phone, contact);
      }
    }

    return phones.map((phone) => byPhone.get(phone)).filter((c): c is Contact => Boolean(c));
  }

  async function resolveCustomFieldAudience(
    supabase: ReturnType<typeof createClient>,
    filter: CustomFieldFilter,
  ): Promise<Contact[]> {
    let query = supabase
      .from('contact_custom_values')
      .select('contact_id')
      .eq('custom_field_id', filter.fieldId);

    if (filter.operator === 'is') query = query.eq('value', filter.value);
    else if (filter.operator === 'is_not') query = query.neq('value', filter.value);
    else query = query.ilike('value', `%${filter.value}%`);

    const { data: matches, error: matchErr } = await query;
    if (matchErr) throw new Error(`Custom-field filter failed: ${matchErr.message}`);

    const ids = [...new Set((matches ?? []).map((m) => m.contact_id))];
    if (ids.length === 0) return [];

    const { data, error } = await supabase.from('contacts').select('*').in('id', ids);
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
    return data ?? [];
  }

  async function createAndSendBroadcast(payload: BroadcastPayload): Promise<string> {
    setIsProcessing(true);
    setProgress(0);
    const supabase = createClient();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('You are not signed in.');

      setProgress(10);
      const contacts = await resolveAudience(payload.audience);
      if (contacts.length === 0) throw new Error('No contacts found for this audience.');

      setProgress(30);
      const { data: broadcast, error: broadcastError } = await supabase
        .from('broadcasts')
        .insert({
          user_id: user.id,
          name: payload.name,
          template_name: payload.template.name,
          template_language: payload.template.language ?? 'en_US',
          template_variables: payload.variables,
          audience_filter: {
            type: payload.audience.type,
            tagIds: payload.audience.tagIds,
            customField: payload.audience.customField,
            excludeTagIds: payload.audience.excludeTagIds,
          },
          status: 'queued',
          total_recipients: contacts.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
          skipped_count: 0,
        })
        .select()
        .single();

      if (broadcastError || !broadcast) {
        throw new Error(`Failed to create broadcast: ${broadcastError?.message ?? 'unknown error'}`);
      }

      setProgress(60);
      const recipientRows = contacts.map((contact) => ({
        broadcast_id: broadcast.id,
        contact_id: contact.id,
        status: 'pending' as const,
      }));

      for (let i = 0; i < recipientRows.length; i += INSERT_BATCH_SIZE) {
        const { error } = await supabase
          .from('broadcast_recipients')
          .insert(recipientRows.slice(i, i + INSERT_BATCH_SIZE));
        if (error) {
          await supabase
            .from('broadcasts')
            .update({ status: 'failed', queue_error: error.message })
            .eq('id', broadcast.id);
          throw new Error(`Failed to insert recipient batch: ${error.message}`);
        }
      }

      setProgress(100);
      return broadcast.id;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing, progress };
}
