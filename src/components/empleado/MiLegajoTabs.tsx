'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { User, FolderOpen, ClipboardList, FileText, Plane } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MiLegajoDatos } from './MiLegajoDatos'
import { MisDocumentos } from './MisDocumentos'
import { MisRecibos } from './MisRecibos'
import { MisLicencias } from './MisLicencias'
import { SolicitudesEmpleadoTabs } from './SolicitudesEmpleadoTabs'

interface Props {
  employee: React.ComponentProps<typeof MiLegajoDatos>['employee']
  employeeId: number
  avatarUrl?: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
}

const TABS = [
  { id: 'datos', label: 'Datos', icon: User },
  { id: 'recibos', label: 'Recibos', icon: FileText },
  { id: 'documentos', label: 'Documentos', icon: FolderOpen },
  { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { id: 'licencias', label: 'Licencias', icon: Plane },
] as const
type Tab = typeof TABS[number]['id']

export function MiLegajoTabs({ employee, employeeId, avatarUrl, avatarBgColor, avatarTextColor }: Props) {
  const searchParams = useSearchParams()
  const initial = (TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'datos') as Tab
  const [tab, setTab] = useState<Tab>(initial)

  return (
    <>
      <div className="flex border-b mb-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5',
                active
                  ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'datos' && (
        <MiLegajoDatos
          employee={employee}
          avatarUrl={avatarUrl}
          avatarBgColor={avatarBgColor}
          avatarTextColor={avatarTextColor}
        />
      )}
      {tab === 'recibos' && <MisRecibos employeeId={employeeId} />}
      {tab === 'documentos' && <MisDocumentos employeeId={employeeId} />}
      {tab === 'solicitudes' && <SolicitudesEmpleadoTabs />}
      {tab === 'licencias' && <MisLicencias />}
    </>
  )
}
