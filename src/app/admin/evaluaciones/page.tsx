'use client'

import { useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { RondasList } from '@/components/evaluaciones/RondasList'
import { EvaluacionesIndividuales } from '@/components/evaluaciones/EvaluacionesIndividuales'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'rondas', label: 'Rondas' },
  { id: 'individuales', label: 'Individuales' },
]

export default function EvaluacionesPage() {
  const [tab, setTab] = useState('rondas')

  return (
    <>
      <AdminHeader title="Evaluaciones de desempeño" />
      <div className="p-4 sm:p-6">
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
        {tab === 'rondas' && <RondasList />}
        {tab === 'individuales' && <EvaluacionesIndividuales />}
      </div>
    </>
  )
}
