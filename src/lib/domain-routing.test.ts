import { describe, expect, it } from 'vitest'

import {
  appHrefForHost,
  marketingHrefForHost,
  matchesDomainPath,
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

  it('matches nested public routes that should leave the app subdomain', () => {
    expect(matchesDomainPath('/features', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/features/flows', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/checkout/pro', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(true)
    expect(matchesDomainPath('/dashboard', PUBLIC_ROOT_DOMAIN_PATHS)).toBe(false)
  })
})
