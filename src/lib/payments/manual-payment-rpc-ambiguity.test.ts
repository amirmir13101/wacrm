import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/058_fix_manual_payment_approval_rpc_ambiguity.sql'),
  'utf8',
)
const adminPaymentRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/payments/[id]/route.ts'),
  'utf8',
)

describe('manual payment approval RPC ambiguity fix', () => {
  it('redefines the approval RPC with explicit PLpgSQL conflict handling', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.approve_manual_pro_payment')
    expect(migration).toContain('#variable_conflict use_column')
    expect(migration).toContain('FROM public.manual_payment_requests AS request')
    expect(migration).toContain('UPDATE public.manual_payment_requests AS request')
    expect(migration).toContain('approved_request.workspace_id')
  })

  it('keeps the admin approval route on the transactional RPC', () => {
    expect(adminPaymentRoute).toContain(".rpc('approve_manual_pro_payment'")
    expect(adminPaymentRoute).toContain('p_request_id: paymentRequest.id')
  })
})

