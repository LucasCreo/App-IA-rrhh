'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SolicitudesUnificadas } from './SolicitudesUnificadas'
import { TabSaldos } from '@/components/ausencias/AusenciasAdmin'
import { AsignacionesList } from '@/components/formularios/AsignacionesList'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'formularios', label: 'Formularios' },
  { id: 'saldos', label: 'Saldos de vacaciones' },
] as const

type Tab = typeof TABS[number]['id']

export function SolicitudesAdminTabs() {
  const searchParams = useSearchParams()
  const initial = (TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'solicitudes') as Tab
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
                ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'solicitudes' && <SolicitudesUnificadas />}
      {tab === 'formularios' && <AsignacionesList />}
      {tab === 'saldos' && <TabSaldos />}
    </>
  )
}
