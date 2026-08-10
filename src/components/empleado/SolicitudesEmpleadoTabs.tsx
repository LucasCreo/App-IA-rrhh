'use client'

import { useState } from 'react'
import { MisSolicitudes } from './MisSolicitudes'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'enviadas', label: 'Enviadas' },
  { id: 'recibidas', label: 'Recibidas' },
] as const

type Tab = typeof TABS[number]['id']

export function SolicitudesEmpleadoTabs() {
  const [tab, setTab] = useState<Tab>('enviadas')

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 border-b border-border w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <MisSolicitudes vista={tab} />
    </div>
  )
}
