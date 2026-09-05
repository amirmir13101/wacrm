import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Inbox conversation deletion', () => {
  it('uses workspace authorization and preserves the Contact record', () => {
    const route = source('src/app/api/whatsapp/conversations/[id]/route.ts')
    const migration = source('supabase/migrations/077_fix_inbox_conversation_deletion.sql')

    expect(route).toContain('requireCurrentWorkspace')
    expect(route).toContain("'reply_to_conversations'")
    expect(route).toContain('canSeeConversation')
    expect(route).toContain("admin.rpc('delete_inbox_conversation'")
    expect(route).toContain('contact_deleted: false')
    expect(migration).toContain('DELETE FROM public.conversations')
    expect(migration).not.toContain('DELETE FROM public.contacts')
    expect(migration).toContain('SET conversation_id = NULL')
    expect(migration).not.toContain('UPDATE public.ai_knowledge_gaps')
  })

  it('supports long press, desktop context selection, and confirmation', () => {
    const list = source('src/components/inbox/conversation-list.tsx')

    expect(list).toContain('onContextMenu={handleContextMenu}')
    expect(list).toContain('event.pointerType !== "touch"')
    expect(list).toContain('setTimeout(() =>')
    expect(list).toContain('450')
    expect(list).toContain('Delete conversation')
    expect(list).toContain('The contact will remain available in Contacts')
    expect(list).toContain('select-none')
    expect(list).toContain('[-webkit-touch-callout:none]')
  })
})
