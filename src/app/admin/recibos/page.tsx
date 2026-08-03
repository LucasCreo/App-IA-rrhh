'use client'

import { useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { LotesTable } from '@/components/lotes/LotesTable'
import { DocumentosTable } from '@/components/documentos/DocumentosTable'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'lotes', label: 'Lotes' },
  { id: 'individuales', label: 'Recibos' },
]

export default function RecibosPage() {
  const [tab, setTab] = useState('lotes')

  return (
    <>
      <AdminHeader title="Recibos de Sueldo" />
      <div className="p-4 sm:p-6">
        <div className="flex border-b mb-6 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'lotes' && <LotesTable />}
        {tab === 'individuales' && <DocumentosTable esRecibo={true} />}
      </div>
    </>
  )
}
