import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('manual Pro payment transaction', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/057_manual_payment_approval_transaction.sql'),
    'utf8',
  )
  const route = readFileSync(
    join(process.cwd(), 'src/app/api/admin/payments/[id]/route.ts'),
    'utf8',
  )

  it('updates profile, workspace, and payment request in one database function', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.approve_manual_pro_payment')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('UPDATE public.profiles')
    expect(migration).toContain('UPDATE public.workspaces')
    expect(migration).toContain('UPDATE public.manual_payment_requests')
    expect(route).toContain(".rpc('approve_manual_pro_payment'")
  })

  it('uses PostgreSQL calendar intervals instead of JavaScript month overflow', () => {
    expect(migration).toContain("p_now + INTERVAL '1 month'")
    expect(migration).toContain("p_now + INTERVAL '1 year'")
    expect(route).not.toContain('.setMonth(')
    expect(route).not.toContain('.setFullYear(')
  })

  it('allows only the service role to execute the approval transaction', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
  })
})
