/**
 * Meta WhatsApp Cloud API helpers.
 *
 * Every function takes a single options object (named parameters) instead
 * of positional arguments. This was a deliberate choice after the same
 * swapped-args bug was found four times in a row with the positional form
 * (e.g. `(accessToken, phoneNumberId)` vs `(phoneNumberId, accessToken)`).
 * With named params, a typo surfaces immediately as a TypeScript error
 * instead of a runtime rejection from Meta.
 */

import type { MetaTemplateSubmitPayload } from './template-components'

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`
const META_VERIFY_TIMEOUT_MS = 8000

export interface MetaSendResult {
  messageId: string
}

export interface MetaPhoneInfo {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
}

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string }
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as MetaErrorResponse
    if (data.error?.message) message = data.error.message
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

// ============================================================
// Phone number / account
// ============================================================

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Verify a Meta phone number ID by fetching its public metadata
 * (display_phone_number, verified_name, quality_rating).
 */
export async function verifyPhoneNumber(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneInfo> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), META_VERIFY_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Meta API verification timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

// ============================================================
// Sending
// ============================================================

export interface SendTextMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  /** Meta's message_id of the message being replied to. Adds a `context` field
   *  so WhatsApp renders the new message as a reply with a quote preview. */
  contextMessageId?: string
}

/**
 * Send a free-form WhatsApp text message.
 * Only works inside the 24-hour customer service window.
 */
export async function sendTextMessage(
  args: SendTextMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, text, contextMessageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export interface SendTemplateMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language?: string
  params?: string[]
  /** Meta's message_id of the message being replied to. */
  contextMessageId?: string
}

/**
 * Send a pre-approved WhatsApp message template. Required outside
 * the 24-hour window and for any first-touch messaging.
 */
export async function sendTemplateMessage(
  args: SendTemplateMessageArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    templateName,
    language = 'en_US',
    params,
    contextMessageId,
  } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  }

  if (params && params.length > 0) {
    template.components = [
      {
        type: 'body',
        parameters: params.map((p) => ({ type: 'text', text: String(p) })),
      },
    ]
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export type MediaKind = 'image' | 'video' | 'document' | 'audio'

export interface SendMediaMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  kind: MediaKind
  link: string
  caption?: string
  filename?: string
  contextMessageId?: string
}

export async function sendMediaMessage(
  args: SendMediaMessageArgs,
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, kind, link, caption, filename, contextMessageId } = args
  if (!link) throw new Error('sendMediaMessage requires a link.')

  const media: Record<string, unknown> = { link }
  if (caption && kind !== 'audio') media.caption = caption
  if (kind === 'document' && filename) media.filename = filename

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: kind,
    [kind]: media,
  }
  if (contextMessageId) body.context = { message_id: contextMessageId }

  const response = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export interface UploadResumableMediaArgs {
  appId: string
  accessToken: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

export async function uploadResumableMedia(
  args: UploadResumableMediaArgs,
): Promise<{ handle: string }> {
  const { appId, accessToken, fileName, mimeType, bytes } = args
  const startParams = new URLSearchParams({
    file_name: fileName,
    file_length: String(bytes.byteLength),
    file_type: mimeType,
    access_token: accessToken,
  })
  const startResponse = await fetch(
    `${META_API_BASE}/${appId}/uploads?${startParams.toString()}`,
    { method: 'POST' },
  )
  if (!startResponse.ok) {
    await throwMetaError(startResponse, `Resumable upload start failed: ${startResponse.status}`)
  }
  const startData = (await startResponse.json()) as { id?: string }
  if (!startData.id) throw new Error('Resumable upload did not return a session id.')

  const uploadResponse = await fetch(`${META_API_BASE}/${startData.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
    },
    body: bytes as unknown as BodyInit,
  })
  if (!uploadResponse.ok) {
    await throwMetaError(uploadResponse, `Resumable upload failed: ${uploadResponse.status}`)
  }
  const uploadData = (await uploadResponse.json()) as { h?: string }
  if (!uploadData.h) throw new Error('Resumable upload did not return a file handle.')
  return { handle: uploadData.h }
}

export interface SubmitMessageTemplateArgs {
  wabaId: string
  accessToken: string
  payload: MetaTemplateSubmitPayload
}

export interface SubmitMessageTemplateResult {
  id: string
  status: string
  category?: string
}

export async function submitMessageTemplate(
  args: SubmitMessageTemplateArgs,
): Promise<SubmitMessageTemplateResult> {
  const response = await fetch(`${META_API_BASE}/${args.wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(args.payload),
  })
  if (!response.ok) await throwMetaError(response, `Meta API error: ${response.status}`)
  const data = await response.json()
  if (!data?.id) throw new Error('Meta accepted the template but returned no id.')
  return {
    id: String(data.id),
    status: typeof data.status === 'string' ? data.status : 'PENDING',
    category: typeof data.category === 'string' ? data.category : undefined,
  }
}

export interface EditMessageTemplateArgs {
  metaTemplateId: string
  accessToken: string
  components: MetaTemplateSubmitPayload['components']
  category?: MetaTemplateSubmitPayload['category']
}

export async function editMessageTemplate(
  args: EditMessageTemplateArgs,
): Promise<{ success: boolean }> {
  const body: Record<string, unknown> = { components: args.components }
  if (args.category) body.category = args.category
  const response = await fetch(`${META_API_BASE}/${args.metaTemplateId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) await throwMetaError(response, `Meta API error: ${response.status}`)
  const data = await response.json().catch(() => ({}))
  return { success: data?.success !== false }
}

export interface DeleteMessageTemplateArgs {
  wabaId: string
  accessToken: string
  name: string
  metaTemplateId?: string
}

export async function deleteMessageTemplate(args: DeleteMessageTemplateArgs): Promise<void> {
  const params = new URLSearchParams({ name: args.name })
  if (args.metaTemplateId) params.set('hsm_id', args.metaTemplateId)
  const response = await fetch(
    `${META_API_BASE}/${args.wabaId}/message_templates?${params.toString()}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    },
  )
  if (response.status === 404) return
  if (!response.ok) await throwMetaError(response, `Meta API error: ${response.status}`)
}

// ============================================================
// Reactions
// ============================================================

export interface SendReactionMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** Meta's message_id of the message being reacted to. */
  targetMessageId: string
  /** Single emoji, or empty string to remove an existing reaction. */
  emoji: string
}

/**
 * Send a reaction (or removal) to a previously-exchanged message.
 * Empty `emoji` removes the reaction per Meta's spec.
 */
export async function sendReactionMessage(
  args: SendReactionMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, targetMessageId, emoji } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: targetMessageId, emoji },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export const INTERACTIVE_LIMITS = {
  maxButtons: 3,
  buttonTitleMaxLength: 20,
  maxListSections: 10,
  maxListRowsTotal: 10,
  listRowTitleMaxLength: 24,
  listRowDescriptionMaxLength: 72,
  bodyMaxLength: 1024,
  footerMaxLength: 60,
  headerTextMaxLength: 60,
} as const

export interface InteractiveButton {
  id: string
  title: string
}

export interface SendInteractiveButtonsArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  bodyText: string
  headerText?: string
  footerText?: string
  buttons: InteractiveButton[]
  contextMessageId?: string
}

export async function sendInteractiveButtons(
  args: SendInteractiveButtonsArgs,
): Promise<MetaSendResult> {
  validateInteractiveBody(args.bodyText)
  validateInteractiveHeaderFooter(args.headerText, args.footerText)
  if (args.buttons.length < 1 || args.buttons.length > INTERACTIVE_LIMITS.maxButtons) {
    throw new Error(
      `Interactive button message requires 1-${INTERACTIVE_LIMITS.maxButtons} buttons (got ${args.buttons.length}).`,
    )
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: args.bodyText },
    action: {
      buttons: args.buttons.map((button) => {
        if (!button.id) throw new Error('Interactive button missing id.')
        if (!button.title) throw new Error(`Interactive button "${button.id}" missing title.`)
        if (button.title.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
          throw new Error(
            `Interactive button title "${button.title}" exceeds ${INTERACTIVE_LIMITS.buttonTitleMaxLength} chars.`,
          )
        }
        return { type: 'reply', reply: { id: button.id, title: button.title } }
      }),
    },
  }
  if (args.headerText) interactive.header = { type: 'text', text: args.headerText }
  if (args.footerText) interactive.footer = { text: args.footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: args.to,
    type: 'interactive',
    interactive,
  }
  if (args.contextMessageId) body.context = { message_id: args.contextMessageId }

  const response = await fetch(`${META_API_BASE}/${args.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) await throwMetaError(response, `Meta API error: ${response.status}`)
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export interface InteractiveListRow {
  id: string
  title: string
  description?: string
}

export interface InteractiveListSection {
  title?: string
  rows: InteractiveListRow[]
}

export interface SendInteractiveListArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  bodyText: string
  buttonLabel: string
  headerText?: string
  footerText?: string
  sections: InteractiveListSection[]
  contextMessageId?: string
}

export async function sendInteractiveList(
  args: SendInteractiveListArgs,
): Promise<MetaSendResult> {
  validateInteractiveBody(args.bodyText)
  validateInteractiveHeaderFooter(args.headerText, args.footerText)
  if (!args.buttonLabel) throw new Error('Interactive list requires a buttonLabel.')
  if (args.buttonLabel.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
    throw new Error(
      `Interactive list buttonLabel "${args.buttonLabel}" exceeds ${INTERACTIVE_LIMITS.buttonTitleMaxLength} chars.`,
    )
  }
  if (args.sections.length < 1 || args.sections.length > INTERACTIVE_LIMITS.maxListSections) {
    throw new Error(
      `Interactive list requires 1-${INTERACTIVE_LIMITS.maxListSections} sections (got ${args.sections.length}).`,
    )
  }
  const totalRows = args.sections.reduce((sum, section) => sum + section.rows.length, 0)
  if (totalRows < 1 || totalRows > INTERACTIVE_LIMITS.maxListRowsTotal) {
    throw new Error(
      `Interactive list requires 1-${INTERACTIVE_LIMITS.maxListRowsTotal} rows total across all sections (got ${totalRows}).`,
    )
  }

  const seenIds = new Set<string>()
  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: args.bodyText },
    action: {
      button: args.buttonLabel,
      sections: args.sections.map((section) => ({
        ...(section.title ? { title: section.title } : {}),
        rows: section.rows.map((row) => {
          if (!row.id) throw new Error('Interactive list row missing id.')
          if (seenIds.has(row.id)) throw new Error(`Interactive list has duplicate row id "${row.id}".`)
          seenIds.add(row.id)
          if (!row.title) throw new Error(`Interactive list row "${row.id}" missing title.`)
          if (row.title.length > INTERACTIVE_LIMITS.listRowTitleMaxLength) {
            throw new Error(
              `Interactive list row title "${row.title}" exceeds ${INTERACTIVE_LIMITS.listRowTitleMaxLength} chars.`,
            )
          }
          if (
            row.description &&
            row.description.length > INTERACTIVE_LIMITS.listRowDescriptionMaxLength
          ) {
            throw new Error(
              `Interactive list row description for "${row.id}" exceeds ${INTERACTIVE_LIMITS.listRowDescriptionMaxLength} chars.`,
            )
          }
          return {
            id: row.id,
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
          }
        }),
      })),
    },
  }
  if (args.headerText) interactive.header = { type: 'text', text: args.headerText }
  if (args.footerText) interactive.footer = { text: args.footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: args.to,
    type: 'interactive',
    interactive,
  }
  if (args.contextMessageId) body.context = { message_id: args.contextMessageId }

  const response = await fetch(`${META_API_BASE}/${args.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) await throwMetaError(response, `Meta API error: ${response.status}`)
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

function validateInteractiveBody(bodyText: string): void {
  if (!bodyText) throw new Error('Interactive message requires bodyText.')
  if (bodyText.length > INTERACTIVE_LIMITS.bodyMaxLength) {
    throw new Error(`Interactive bodyText exceeds ${INTERACTIVE_LIMITS.bodyMaxLength} chars.`)
  }
}

function validateInteractiveHeaderFooter(
  headerText: string | undefined,
  footerText: string | undefined,
): void {
  if (headerText && headerText.length > INTERACTIVE_LIMITS.headerTextMaxLength) {
    throw new Error(`Interactive headerText exceeds ${INTERACTIVE_LIMITS.headerTextMaxLength} chars.`)
  }
  if (footerText && footerText.length > INTERACTIVE_LIMITS.footerMaxLength) {
    throw new Error(`Interactive footerText exceeds ${INTERACTIVE_LIMITS.footerMaxLength} chars.`)
  }
}

// ============================================================
// Media
// ============================================================

export interface GetMediaUrlArgs {
  mediaId: string
  accessToken: string
}

/**
 * Resolve a media ID to Meta's (short-lived, authenticated) CDN URL
 * plus the MIME type. Step one of the media-proxy flow.
 */
export async function getMediaUrl(
  args: GetMediaUrlArgs
): Promise<{ url: string; mimeType: string }> {
  const { mediaId, accessToken } = args
  const response = await fetch(`${META_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Media fetch failed: ${response.status}`)
  }
  const data = await response.json()
  if (!data.url) throw new Error('Media URL not found in Meta response')
  return { url: data.url, mimeType: data.mime_type || 'application/octet-stream' }
}

export interface DownloadMediaArgs {
  downloadUrl: string
  accessToken: string
}

/**
 * Fetch the binary bytes for a media URL obtained from getMediaUrl.
 * Step two of the media-proxy flow.
 */
export async function downloadMedia(
  args: DownloadMediaArgs
): Promise<{ buffer: Buffer; contentType: string }> {
  const { downloadUrl, accessToken } = args
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Media download failed: ${response.status}`)
  }
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}
