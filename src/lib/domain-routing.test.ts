import { describe, expect, it } from 'vitest'

import {
  appHrefForHost,
  APP_DOMAIN_PATHS,
  marketingHrefForHost,
  matchesDomainPath,
  productionDomainRedirectUrl,
  PUBLIC_ROOT_DOMAIN_PATHS,
} from './domain-routing'

describe('production domain routing helpers', () => {
  it('keeps public marketing links on the root domain from the app subdomain', () => {
    expect(marketingHrefForHost('/features', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/features',
    )
    expect(marketingHrefForHost('/features/flows', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/features/flows',
    )
    expect(marketingHrefForHost('/pricing', 'localhost')).toBe('/pricing')
  })

  it('keeps account links on the app domain from root marketing pages', () => {
    expect(appHrefForHost('/login', 'talkwagon.chat')).toBe(
      'https://app.talkwagon.chat/login',
    )
    expect(appHrefForHost('/signup', 'www.talkwagon.chat')).toBe(
      'https://app.talkwagon.chat/signup',
    )
    expect(appHrefForHost('/login', 'localhost')).toBe('/login')
  })

  it('treats admin dashboard routes as app-domain routes so auth cookies stay consistent', () => {
    expect(appHrefForHost('/admintops', 'talkwagon.chat')).toBe(
      'https://app.talkwagon.chat/admintops',
    )
    expect(matchesDomainPath('/admintops', APP_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/admin/users', APP_DOMAIN_PATHS)).toBe(true)
  })

  it('matches nested public routes that should leave the app subdomain', () => {
    expect(matchesDomainPath('/features', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/features/flows', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/checkout/pro', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/use-cases/sales', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/wati-alternative', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/whatsapp-api-prices', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/dashboard', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(false)
  })

  it('redirects marketing routes from the app subdomain to the root domain', () => {
    expect(productionDomainRedirectUrl('/pricing', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/pricing',
    )
    expect(productionDomainRedirectUrl('/features', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/features',
    )
    expect(productionDomainRedirectUrl('/checkout/pro', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/checkout/pro',
    )
    expect(productionDomainRedirectUrl('/use-cases/newsletter', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/use-cases/newsletter',
    )
    expect(productionDomainRedirectUrl('/wati-alternative', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/wati-alternative',
    )
    expect(productionDomainRedirectUrl('/whatsapp-api-prices', 'app.talkwagon.chat')).toBe(
      'https://talkwagon.chat/whatsapp-api-prices',
    )
  })

  it('keeps app routes on the app subdomain so auth and protected redirects still work', () => {
    expect(productionDomainRedirectUrl('/login', 'app.talkwagon.chat')).toBeNull()
    expect(productionDomainRedirectUrl('/dashboard', 'app.talkwagon.chat')).toBeNull()
    expect(productionDomainRedirectUrl('/settings', 'app.talkwagon.chat')).toBeNull()
  })

  it('keeps marketing routes on the root domain to avoid redirect loops', () => {
    expect(productionDomainRedirectUrl('/pricing', 'talkwagon.chat')).toBeNull()
    expect(productionDomainRedirectUrl('/features', 'talkwagon.chat')).toBeNull()
    expect(productionDomainRedirectUrl('/checkout/pro', 'talkwagon.chat')).toBeNull()
  })

  it('moves root-domain app routes to the app subdomain', () => {
    expect(productionDomainRedirectUrl('/login', 'talkwagon.chat')).toBe(
      'https://app.talkwagon.chat/login',
    )
    expect(productionDomainRedirectUrl('/dashboard', 'talkwagon.chat', '?upgrade=required')).toBe(
      'https://app.talkwagon.chat/dashboard?upgrade=required',
    )
  })

  it('handles proxied host headers with ports or comma-separated forwarded hosts', () => {
    expect(productionDomainRedirectUrl('/pricing', 'app.talkwagon.chat:443')).toBe(
      'https://talkwagon.chat/pricing',
    )
    expect(
      productionDomainRedirectUrl('/features', 'app.talkwagon.chat, localhost:3000'),
    ).toBe('https://talkwagon.chat/features')
  })
})
