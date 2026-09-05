import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Inbox message deletion', () => {
  it('supports touch long-press, desktop context selection, and a Delete action', () => {
    const actions = source('src/components/inbox/message-actions.tsx')

    expect(actions).toContain('event.pointerType !== "touch"')
    expect(actions).toContain('onContextMenu={handleContextMenu}')
    expect(actions).toContain('aria-label="Delete message"')
    expect(actions).toContain('data-selected=')
    expect(actions).toContain('bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]')
    expect(actions).toContain('max-w-[calc(100vw-1.5rem)]')
    expect(actions).toContain('>Delete</span>')
    expect(actions).toContain('select-none')
    expect(actions).toContain('[-webkit-touch-callout:none]')
  })

  it('requires confirmation and clearly limits deletion to CRM history', () => {
    const thread = source('src/components/inbox/message-thread.tsx')

    expect(thread).toContain('Are you sure you want to delete this message?')
    expect(thread).toContain('does not recall an')
    expect(thread).toContain('method: "DELETE"')
  })

  it('checks workspace permission and conversation visibility on the server', () => {
    const route = source('src/app/api/whatsapp/messages/[id]/route.ts')

    expect(route).toContain("'reply_to_conversations'")
    expect(route).toContain('canSeeConversation')
    expect(route).toContain("admin.rpc('delete_inbox_message'")
    expect(route).toContain('whatsapp_recalled: false')
  })

  it('atomically recalculates the latest remaining conversation message', () => {
    const migration = source(
      'supabase/migrations/074_inbox_outbound_messages_and_deletion.sql',
    )

    expect(migration).toContain('DELETE FROM public.messages')
    expect(migration).toContain('ORDER BY message.created_at DESC, message.id DESC')
    expect(migration).toContain('last_message_text = v_latest_content')
    expect(migration).toContain('last_message_at = v_latest_at')
  })
})
