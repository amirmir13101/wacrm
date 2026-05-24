import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { dedupeSharedPricingRates } from '@/lib/whatsapp/pricing-rates'
import type { WhatsAppPricingRate } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (profile?.approval_status !== 'approved') {
    return NextResponse.json({ error: 'Account approval required' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin()
    .from('whatsapp_pricing_rates')
    .select('*')
    .order('country_name')

  if (error) {
    return NextResponse.json({ error: `Failed to load pricing rates: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    rates: dedupeSharedPricingRates((data ?? []) as WhatsAppPricingRate[]),
  })
}
