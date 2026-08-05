'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SolicitudesUnificadas } from './SolicitudesUnificadas'
import { AsignacionesList } from '@/components/formularios/AsignacionesList'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'recibidas', label: 'Recibidas' },
  { id: 'enviadas', label: 'Enviadas' },
] as const

type Tab = typeof TABS[number]['id']

export function SolicitudesAdminTabs() {
  const searchParams = useSearchParams()
  const initial = (TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'recibidas') as Tab
  const [tab, setTab] = useState<Tab>(initial)

  return (
    <>
      <div className="flex border-b mb-6 overflow-x-auto overflow-y-hidden whitespace-nowrap">
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

      {tab === 'recibidas' && <SolicitudesUnificadas />}
      {tab === 'enviadas' && <AsignacionesList />}
    </>
  )
}
