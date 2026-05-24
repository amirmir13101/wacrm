import type { WhatsAppPricingRate } from '@/types'

function rankRate(rate: WhatsAppPricingRate) {
  return [
    rate.verified_by_admin ? 1 : 0,
    rate.last_verified_at ? new Date(rate.last_verified_at).getTime() : 0,
    rate.updated_at ? new Date(rate.updated_at).getTime() : 0,
  ]
}

export function dedupeSharedPricingRates(rates: WhatsAppPricingRate[]) {
  const byMarket = new Map<string, WhatsAppPricingRate>()

  for (const rate of rates) {
    const key = `${rate.iso_country_code.toUpperCase()}:${rate.currency.toUpperCase()}`
    const existing = byMarket.get(key)
    if (!existing) {
      byMarket.set(key, rate)
      continue
    }

    const currentRank = rankRate(rate)
    const existingRank = rankRate(existing)
    if (
      currentRank[0] > existingRank[0] ||
      (currentRank[0] === existingRank[0] && currentRank[1] > existingRank[1]) ||
      (currentRank[0] === existingRank[0] &&
        currentRank[1] === existingRank[1] &&
        currentRank[2] > existingRank[2])
    ) {
      byMarket.set(key, rate)
    }
  }

  return [...byMarket.values()].sort((a, b) => a.country_name.localeCompare(b.country_name))
}
