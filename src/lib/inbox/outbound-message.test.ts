import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderTemplatePreview } from './outbound-message'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('outbound Broadcast messages in Inbox', () => {
  it('renders the template body with the exact resolved recipient values', () => {
    expect(
      renderTemplatePreview('Hi {{1}}, order {{2}} is ready.', ['Amir', 'TW-42']),
    ).toBe('Hi Amir, order TW-42 is ready.')
    expect(renderTemplatePreview('Hi {{1}} — {{2}}', ['Amir'])).toBe(
      'Hi Amir — {{2}}',
    )
  })

  it('mirrors only successful sends and keeps failed sends out of Inbox history', () => {
    const worker = source('src/app/api/whatsapp/broadcast/worker/route.ts')
    const successBranch = worker.indexOf("if (result.status === 'sent')")
    const mirrorCall = worker.indexOf('await recordSentBroadcastMessage', successBranch)
    const failureBranch = worker.indexOf('} else {', mirrorCall)

    expect(successBranch).toBeGreaterThan(-1)
    expect(mirrorCall).toBeGreaterThan(successBranch)
    expect(mirrorCall).toBeLessThan(failureBranch)
  })

  it('does not count outbound realtime messages as unread customer messages', () => {
    const inbox = source('src/app/(dashboard)/inbox/page.tsx')

    expect(inbox).toContain('newMsg.sender_type !== "customer"')
    expect(inbox).toContain('? c.unread_count')
  })

  it('uses a workspace/contact lock and Meta message idempotency in the database', () => {
    const migration = source(
      'supabase/migrations/074_inbox_outbound_messages_and_deletion.sql',
    )

    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('message.message_id = p_whatsapp_message_id')
    expect(migration).toContain("'agent'")
    expect(migration).toContain("'template'")
  })

  it('backfills only historical successful recipients without duplicating WAMIDs', () => {
    const backfillMigration = source(
      'supabase/migrations/075_backfill_successful_broadcast_messages.sql',
    )

    expect(backfillMigration).toContain(
      "broadcast_recipient.status IN ('sent', 'delivered', 'read', 'replied')",
    )
    expect(backfillMigration).toContain(
      'broadcast_recipient.whatsapp_message_id IS NOT NULL',
    )
    expect(backfillMigration).toContain('broadcast_recipient.sent_at IS NOT NULL')
    expect(backfillMigration).toContain('NOT EXISTS')
    expect(backfillMigration).toContain(
      'message.message_id = broadcast_recipient.whatsapp_message_id',
    )
    expect(backfillMigration).toContain('record_outbound_inbox_message')
    expect(backfillMigration).not.toContain("status IN ('failed', 'skipped')")
  })
})
