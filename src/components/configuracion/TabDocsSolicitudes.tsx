'use client'

import { useState } from 'react'
import { TabDocumentos } from './TabDocumentos'
import { TabSolicitudes } from './TabSolicitudes'
import { cn } from '@/lib/utils'

const SUB_TABS = [
  { id: 'documentos', label: 'Documentos' },
  { id: 'solicitudes', label: 'Solicitudes' },
] as const

type SubTab = typeof SUB_TABS[number]['id']

export function TabDocsSolicitudes() {
  const [sub, setSub] = useState<SubTab>('documentos')

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-md border border-input bg-muted/30 p-1">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              sub === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'documentos' && <TabDocumentos />}
      {sub === 'solicitudes' && <TabSolicitudes />}
    </div>
  )
}
