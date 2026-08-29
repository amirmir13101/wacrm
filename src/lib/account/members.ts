import type { AccountMember } from '@/types'

export async function fetchAccountMembers(): Promise<AccountMember[]> {
  const res = await fetch('/api/team/members', { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json().catch(() => null)
  const rows = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : []
  return rows as AccountMember[]
}

export function memberLabel(member: AccountMember): string {
  return member.full_name || member.email || member.user_id
}
