'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentosTable } from '@/components/documentos/DocumentosTable'
import { AsignacionesList } from '@/components/formularios/AsignacionesList'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'documentos', label: 'Documentos' },
  { id: 'formularios', label: 'Formularios' },
] as const

type Tab = typeof TABS[number]['id']

export default function DocumentosPage() {
  const searchParams = useSearchParams()
  const initial = (searchParams.get('tab') as Tab) === 'formularios' ? 'formularios' : 'documentos'
  const [tab, setTab] = useState<Tab>(initial)

  return (
    <>
      <AdminHeader title="Documentos" />
      <div className="p-4 sm:p-6">
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
        {tab === 'documentos' && <DocumentosTable esRecibo={false} />}
        {tab === 'formularios' && <AsignacionesList />}
      </div>
    </>
  )
}
