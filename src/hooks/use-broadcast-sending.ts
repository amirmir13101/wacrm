'use client';

import { useState } from 'react';
import { MessageTemplate, VariableMapping } from '@/types';

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
  acknowledgeBilling?: boolean;
  acknowledgeMissingPricing?: boolean;
}

interface UseBroadcastSendingReturn {
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
  progress: number;
}

export function useBroadcastSending(): UseBroadcastSendingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  async function createAndSendBroadcast(payload: BroadcastPayload): Promise<string> {
    setIsProcessing(true);
    setProgress(0);

    try {
      setProgress(10);
      const response = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'queue',
          name: payload.name,
          template_id: payload.template.id,
          audience: payload.audience,
          variables: payload.variables,
          acknowledge_billing: payload.acknowledgeBilling,
          acknowledge_missing_pricing: payload.acknowledgeMissingPricing,
        }),
      });

      setProgress(80);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to queue broadcast');
      }

      setProgress(100);
      return result.broadcast_id;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing, progress };
}
