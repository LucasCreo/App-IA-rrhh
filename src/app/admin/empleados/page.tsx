'use client'

import { useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { EmpleadosTable } from '@/components/empleados/EmpleadosTable'
import { OrganigramaView } from '@/components/empleados/OrganigramaView'
import { cn } from '@/lib/utils'

export default function EmpleadosPage() {
  const [tab, setTab] = useState<'listado' | 'organigrama'>('listado')

  return (
    <>
      <AdminHeader title="Legajos" />
      <div className="p-4 sm:p-6">
        <div className="flex border-b mb-6 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          {[
            { id: 'listado', label: 'Listado' },
            { id: 'organigrama', label: 'Organigrama' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
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
        {tab === 'listado' && <EmpleadosTable />}
        {tab === 'organigrama' && <OrganigramaView />}
      </div>
    </>
  )
}
