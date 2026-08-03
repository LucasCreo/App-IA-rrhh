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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex border-b overflow-x-auto whitespace-nowrap px-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        <MisSolicitudes vista={tab} />
      </div>
    </div>
  )
}
