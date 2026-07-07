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
})
