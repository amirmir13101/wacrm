'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  isDuplicatePhoneError,
  normalizePhoneForComparison,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp/phone-utils';
import { parseCsvConsent } from '@/lib/contacts/consent';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  city?: string;
  category?: string;
  whatsapp_opt_in?: string;
  opt_in?: string;
  subscribed?: string;
  consent?: string;
  opt_in_source?: string;
  opted_out?: string;
  unsubscribed?: string;
  opt_out_reason?: string;
}

interface ImportResult {
  imported: number;
  failed: number;
  skippedDuplicates: number;
  invalidPhones: number;
  optedIn: number;
  notOptedIn: number;
  optedOut: number;
  duplicateDetails: string[];
  invalidDetails: string[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));

  const phoneIdx = headers.indexOf('phone');
  if (phoneIdx === -1) return [];

  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const companyIdx = headers.indexOf('company');
  const cityIdx = headers.indexOf('city');
  const categoryIdx = headers.indexOf('category');
  const optionalHeaders = [
    'whatsapp_opt_in',
    'opt_in',
    'subscribed',
    'consent',
    'opt_in_source',
    'opted_out',
    'unsubscribed',
    'opt_out_reason',
  ] as const;
  const optionalIndexes = Object.fromEntries(
    optionalHeaders.map((header) => [header, headers.indexOf(header)]),
  ) as Record<(typeof optionalHeaders)[number], number>;

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const phone = values[phoneIdx]?.replace(/["']/g, '').trim();
    if (!phone) continue;

    const parsed: ParsedRow = {
      phone,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      email: emailIdx >= 0 ? values[emailIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      company:
        companyIdx >= 0 ? values[companyIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      city: cityIdx >= 0 ? values[cityIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      category:
        categoryIdx >= 0 ? values[categoryIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
    };

    optionalHeaders.forEach((header) => {
      const idx = optionalIndexes[header];
      if (idx >= 0) parsed[header] = values[idx]?.replace(/["']/g, '').trim() || undefined;
    });

    rows.push(parsed);
  }

  return rows;
}

export function ImportModal({ open, onOpenChange, onImported }: ImportModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      toast.error('No valid rows found. Ensure CSV has a "phone" column header.');
      setParsedRows([]);
      return;
    }

    setParsedRows(rows);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      let imported = 0;
      let failed = 0;
      let skippedDuplicates = 0;
      let invalidPhones = 0;
      let optedIn = 0;
      let notOptedIn = 0;
      let optedOut = 0;
      const duplicateDetails: string[] = [];
      const invalidDetails: string[] = [];

      const { data: existingContacts, error: lookupError } = await supabase
        .from('contacts')
        .select('id, phone')
        .eq('user_id', user.id);

      if (lookupError) throw lookupError;

      const seenPhones = new Set(
        (existingContacts ?? []).map((contact) => normalizePhoneForComparison(contact.phone)),
      );

      const rowsToImport: ParsedRow[] = [];
      parsedRows.forEach((row, index) => {
        try {
          const normalizedPhone = normalizeWhatsAppPhone(row.phone).phone;
          if (seenPhones.has(normalizedPhone)) {
            skippedDuplicates++;
            duplicateDetails.push(`Row ${index + 2}: ${row.phone}`);
            return;
          }

          seenPhones.add(normalizedPhone);
          rowsToImport.push({
            ...row,
            phone: normalizedPhone,
          });

          const consent = parseCsvConsent(row);
          if (consent.opted_out_at) optedOut++;
          else if (consent.whatsapp_opt_in) optedIn++;
          else notOptedIn++;
        } catch (err) {
          invalidPhones++;
          const reason = err instanceof Error ? err.message : 'Invalid phone number';
          invalidDetails.push(`Row ${index + 2}: ${row.phone} (${reason})`);
        }
      });

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < rowsToImport.length; i += chunkSize) {
        const chunk = rowsToImport.slice(i, i + chunkSize);
        const rows = chunk.map((row) => ({
          ...parseCsvConsent(row),
          user_id: user.id,
          phone: row.phone,
          name: row.name || null,
          email: row.email || null,
          company: row.company || null,
        }));

        const { data, error } = await supabase
          .from('contacts')
          .insert(rows)
          .select('id');

        if (error) {
          // Try individual inserts for this chunk
          for (const row of rows) {
            const { error: singleErr } = await supabase.from('contacts').insert(row);
            if (singleErr) {
              if (isDuplicatePhoneError(singleErr)) {
                skippedDuplicates++;
                duplicateDetails.push(`Phone ${row.phone}`);
              } else {
                failed++;
              }
            } else {
              imported++;
            }
          }
        } else {
          imported += data?.length ?? chunk.length;
        }
      }

      setResult({
        imported,
        failed,
        skippedDuplicates,
        invalidPhones,
        optedIn,
        notOptedIn,
        optedOut,
        duplicateDetails,
        invalidDetails,
      });
      void recordAdminImportAudit({
        campaignName: file?.name || 'Contact import',
        rows: parsedRows,
        imported,
        failed,
        invalidPhones,
      });
      if (imported > 0) {
        toast.success(`${imported} contact${imported !== 1 ? 's' : ''} imported`);
        onImported();
      }
      if (skippedDuplicates > 0) {
        toast.info(`${skippedDuplicates} duplicate row${skippedDuplicates !== 1 ? 's' : ''} skipped`);
      }
      if (invalidPhones > 0) {
        toast.error(`${invalidPhones} row${invalidPhones !== 1 ? 's have' : ' has'} invalid phone numbers`);
      }
      if (failed > 0) {
        toast.error(`${failed} contact${failed !== 1 ? 's' : ''} failed to import`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  async function recordAdminImportAudit({
    campaignName,
    rows,
    imported,
    failed,
    invalidPhones,
  }: {
    campaignName: string;
    rows: ParsedRow[];
    imported: number;
    failed: number;
    invalidPhones: number;
  }) {
    try {
      await fetch('/api/contacts/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaignName,
          source: 'contacts_csv',
          total_count: rows.length,
          valid_count: imported,
          invalid_count: failed + invalidPhones,
          rows: rows.map((row) => {
            let phone = row.phone;
            try {
              phone = normalizeWhatsAppPhone(row.phone).phone;
            } catch {
              // Keep the original value for audit visibility.
            }
            const consent = parseCsvConsent(row);
            return {
              name: row.name ?? null,
              phone,
              city: row.city ?? null,
              category: row.category ?? row.company ?? null,
              opt_in_status: consent.opted_out_at
                ? 'opted_out'
                : consent.whatsapp_opt_in
                  ? 'opted_in'
                  : 'not_opted_in',
              raw_data: row,
            };
          }),
        }),
      });
    } catch {
      // Import success should not be rolled back if platform audit logging fails.
    }
  }

  const preview = parsedRows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Import Contacts</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload a CSV file with a &quot;phone&quot; column (required). Optional columns:
            name, email, company, whatsapp_opt_in, opt_in_source, opted_out,
            opt_out_reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#3ddf84]/60 p-6 cursor-pointer transition-colors hover:border-[#3ddf84]/80"
          >
            {file ? (
              <>
                <FileText className="size-8 text-violet-400" />
                <p className="text-sm text-slate-300">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} detected
                </p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-slate-500" />
                <p className="text-sm text-slate-400">
                  Click to upload CSV file
                </p>
                <p className="text-xs text-slate-500">
                  CSV with &quot;phone&quot; column required
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Preview table */}
          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Preview (first {preview.length} rows)
              </p>
              <div className="overflow-hidden rounded-lg border border-[#3ddf84]/60 transition-colors hover:border-[#3ddf84]/80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Phone</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Name</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Email</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-700/50">
                        <td className="px-3 py-1.5 text-slate-300">{row.phone}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.name || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.email || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.company || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <p className="text-xs text-slate-500">
                  ...and {parsedRows.length - 5} more rows
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-2 rounded-lg border border-[#3ddf84]/60 p-4 transition-colors hover:border-[#3ddf84]/80">
              <p className="text-sm font-medium text-white">Import Complete</p>
              <div className="flex items-center gap-4">
                {result.imported > 0 && (
                  <div className="flex items-center gap-1.5 text-violet-400 text-sm">
                    <CheckCircle className="size-4" />
                    {result.imported} imported
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle className="size-4" />
                    {result.failed} failed
                  </div>
                )}
                {result.skippedDuplicates > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-sm">
                    <XCircle className="size-4" />
                    {result.skippedDuplicates} duplicates skipped
                  </div>
                )}
                {result.invalidPhones > 0 && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle className="size-4" />
                    {result.invalidPhones} invalid phones
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                  {result.optedIn} opted in
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                  {result.notOptedIn} not opted in
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                  {result.optedOut} opted out
                </div>
              </div>
              {result.duplicateDetails.length > 0 && (
                <div className="text-xs text-slate-400">
                  <p className="font-medium text-slate-300">Duplicate rows</p>
                  <p>{result.duplicateDetails.slice(0, 5).join(', ')}</p>
                </div>
              )}
              {result.invalidDetails.length > 0 && (
                <div className="text-xs text-slate-400">
                  <p className="font-medium text-slate-300">Invalid phone rows</p>
                  <p>{result.invalidDetails.slice(0, 5).join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-900 border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importing}
              onClick={handleImport}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import {parsedRows.length > 0 ? `${parsedRows.length} Contacts` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
