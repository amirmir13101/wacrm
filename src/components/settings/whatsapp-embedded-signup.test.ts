import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const whatsappConfigUi = readFileSync(
  join(process.cwd(), 'src/components/settings/whatsapp-config.tsx'),
  'utf8',
)

const embeddedSignupConfigRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/embedded-signup/config/route.ts'),
  'utf8',
)

const embeddedSignupCallbackRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/embedded-signup/callback/route.ts'),
  'utf8',
)

describe('WhatsApp Embedded Signup settings UI', () => {
  it('defaults to the Connect WhatsApp setup mode', () => {
    expect(whatsappConfigUi).toContain("useState<SetupMode>('connect')")
    expect(whatsappConfigUi).toContain('Connect WhatsApp')
    expect(whatsappConfigUi).toContain('Connect with WhatsApp')
  })

  it('keeps the existing Manual Setup credential form and save action available', () => {
    expect(whatsappConfigUi).toContain('Manual Setup')
    expect(whatsappConfigUi).toContain('Phone Number ID')
    expect(whatsappConfigUi).toContain('Permanent Access Token')
    expect(whatsappConfigUi).toContain('Webhook Verify Token')
    expect(whatsappConfigUi).toContain('Save Configuration')
    expect(whatsappConfigUi).toContain("fetch('/api/whatsapp/config'")
  })

  it('shows a clear setup error when platform Embedded Signup env is missing', () => {
    expect(whatsappConfigUi).toContain('Embedded Signup is not configured')
    expect(whatsappConfigUi).toContain('META_APP_ID')
    expect(whatsappConfigUi).toContain('META_EMBEDDED_SIGNUP_CONFIG_ID')
    expect(whatsappConfigUi).toContain('META_APP_SECRET')
  })

  it('does not pass async functions directly to the Meta SDK callbacks', () => {
    expect(whatsappConfigUi).toContain('window.fbAsyncInit = () =>')
    expect(whatsappConfigUi).not.toMatch(/window\.fbAsyncInit\s*=\s*async/)
    expect(whatsappConfigUi).not.toMatch(/window\.FB\.login\(\s*async/)
    expect(whatsappConfigUi).toContain('function handleFacebookLoginCallback(response)')
    expect(whatsappConfigUi).toContain('void handleEmbeddedSignupLoginResponse(response)')
  })

  it('shows clean Embedded Signup cancellation and Meta error messages', () => {
    expect(whatsappConfigUi).toContain('Connection cancelled.')
    expect(whatsappConfigUi).toContain('response.error?.message')
    expect(whatsappConfigUi).toContain('response.error_message')
  })

  it('launches the current Meta Embedded Signup flow with the required setup object', () => {
    expect(whatsappConfigUi).toContain('setup: {}')
    expect(whatsappConfigUi).not.toContain('sessionInfoVersion')
  })

  it('clears cached Embedded Signup asset IDs before each connection attempt', () => {
    expect(whatsappConfigUi).toContain('embeddedSignupIdsRef.current = {}')
    expect(whatsappConfigUi).toContain('setEmbeddedSignupIds({})')
  })

  it('keeps optional Meta-hosted signup gated server-side without exposing it in the UI', () => {
    expect(embeddedSignupConfigRoute).toContain('META_HOSTED_EMBEDDED_SIGNUP_ENABLED')
    expect(embeddedSignupConfigRoute).toContain('META_SYSTEM_USER_ACCESS_TOKEN')
    expect(whatsappConfigUi).not.toContain('Meta-hosted Signup')
    expect(whatsappConfigUi).not.toContain('account-update webhook')
  })

  it('handles Embedded Signup IDs from supported Meta payload shapes', () => {
    expect(whatsappConfigUi).toContain('function getEmbeddedSignupIds')
    expect(whatsappConfigUi).toContain('payload.data?.phone_number_id')
    expect(whatsappConfigUi).toContain('payload.data?.phoneNumberId')
    expect(whatsappConfigUi).toContain('payload.data?.phone?.id')
    expect(whatsappConfigUi).toContain('payload.data?.waba_id')
    expect(whatsappConfigUi).toContain('payload.data?.wabaId')
    expect(whatsappConfigUi).toContain('payload.data?.whatsapp_business_account?.id')
  })

  it('waits briefly for the Embedded Signup postMessage before reporting missing phone ID', () => {
    expect(whatsappConfigUi).toContain('function waitForEmbeddedSignupIds')
    expect(whatsappConfigUi).toContain('await waitForEmbeddedSignupIds()')
    expect(whatsappConfigUi).toContain('Date.now() - startedAt >= 4000')
  })
})

describe('WhatsApp Embedded Signup API security', () => {
  it('protects the config route with workspace auth and WhatsApp permissions', () => {
    expect(embeddedSignupConfigRoute).toContain('requireCurrentWorkspace')
    expect(embeddedSignupConfigRoute).toContain('manage_whatsapp_config')
    expect(embeddedSignupConfigRoute).toContain('connect_own_whatsapp_config')
  })

  it('does not return the Meta app secret to the browser', () => {
    expect(embeddedSignupConfigRoute).toContain('META_APP_SECRET')
    expect(embeddedSignupConfigRoute).not.toContain('appSecret:')
    expect(embeddedSignupConfigRoute).not.toContain('META_APP_SECRET,')
  })

  it('exchanges the signup code server-side and encrypts the saved token', () => {
    expect(embeddedSignupCallbackRoute).toContain('requireCurrentWorkspace')
    expect(embeddedSignupCallbackRoute).toContain('META_APP_SECRET')
    expect(embeddedSignupCallbackRoute).toContain('oauth/access_token')
    expect(embeddedSignupCallbackRoute).toContain('encrypt(accessToken)')
    expect(embeddedSignupCallbackRoute).toContain("from('whatsapp_config')")
  })

  it('requires the WABA ID and subscribes it to WhatsApp webhook events before saving as connected', () => {
    expect(embeddedSignupCallbackRoute).toContain('!wabaId')
    expect(embeddedSignupCallbackRoute).toContain('subscribed_apps')
    expect(embeddedSignupCallbackRoute).not.toContain('subscribed_fields')
    expect(embeddedSignupCallbackRoute.indexOf('await subscribeAppToWaba')).toBeLessThan(
      embeddedSignupCallbackRoute.indexOf("from('whatsapp_config')"),
    )
  })

  it('does not let optional phone metadata prevent a completed signup from being saved', () => {
    expect(embeddedSignupCallbackRoute).toContain('optional phone metadata unavailable')
    expect(embeddedSignupCallbackRoute.indexOf('await registerPhoneNumber')).toBeLessThan(
      embeddedSignupCallbackRoute.indexOf('await verifyPhoneNumber'),
    )
  })

  it('keeps the failing Meta stage in safe error messages without logging credentials', () => {
    expect(embeddedSignupCallbackRoute).toContain('Meta authorization code exchange failed:')
    expect(embeddedSignupCallbackRoute).toContain('Meta WABA webhook subscription failed:')
    expect(embeddedSignupCallbackRoute).toContain('Meta phone registration failed:')
  })

  it('generates and encrypts the registration PIN server-side without exposing it in the UI', () => {
    expect(whatsappConfigUi).not.toContain('WhatsApp two-step verification PIN')
    expect(whatsappConfigUi).not.toContain('registrationPin')
    expect(embeddedSignupCallbackRoute).toContain('randomInt(100000, 1000000)')
    expect(embeddedSignupCallbackRoute).toContain('encrypt(registrationPin)')
    expect(embeddedSignupCallbackRoute).toContain('two_step_pin_encrypted')
    expect(embeddedSignupCallbackRoute).toContain('/register`')
    expect(embeddedSignupCallbackRoute).toContain("messaging_product: 'whatsapp'")
    expect(embeddedSignupCallbackRoute.indexOf('await registerPhoneNumber')).toBeLessThan(
      embeddedSignupCallbackRoute.indexOf("from('whatsapp_config')"),
    )
  })

  it('does not expose internal setup security copy in the customer connection UI', () => {
    expect(whatsappConfigUi).not.toContain('Secure official setup')
    expect(whatsappConfigUi).not.toContain('App secrets and access tokens are never exposed')
  })

  it('only accepts Embedded Signup postMessage events from real facebook.com origins', () => {
    expect(whatsappConfigUi).toContain("originHost !== 'facebook.com'")
    expect(whatsappConfigUi).toContain("!originHost.endsWith('.facebook.com')")
    expect(whatsappConfigUi).not.toContain("event.origin.endsWith('facebook.com')")
  })
})
