import { NextResponse } from 'next/server'

import { listFlowTemplates } from '@/lib/flows/templates'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function GET() {
  const guard = await requireWorkspacePermission('view_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const templates = listFlowTemplates().map((template) => ({
    slug: template.slug,
    name: template.name,
    description: template.description,
    icon: template.icon,
    trigger_type: template.trigger_type,
    node_count: template.nodes.length,
  }))

  return NextResponse.json({ templates })
}
