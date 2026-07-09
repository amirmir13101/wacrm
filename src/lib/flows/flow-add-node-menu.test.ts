import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('flow add-node dropdown menus', () => {
  it('wraps Base UI dropdown labels in DropdownMenuGroup on canvas and list views', () => {
    const files = [
      read('src/components/flows/flow-canvas.tsx'),
      read('src/components/flows/flow-builder.tsx'),
    ]

    for (const source of files) {
      expect(source).toContain('DropdownMenuGroup')
      expect(source).toContain('<DropdownMenuGroup>')
      expect(source).toContain('</DropdownMenuGroup>')
      expect(source).toContain('<DropdownMenuLabel')
      expect(source).not.toContain('<div key={group.id}>')
    }
  })
})
