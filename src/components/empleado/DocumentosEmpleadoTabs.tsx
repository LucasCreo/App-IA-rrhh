'use client'

import { useState } from 'react'
import { MisDocumentos } from './MisDocumentos'
import { MisSolicitudes } from './MisSolicitudes'
import { cn } from '@/lib/utils'

interface Props { employeeId: number }

export function DocumentosEmpleadoTabs({ employeeId }: Props) {
  const [tab, setTab] = useState<'recibidos' | 'solicitudes'>('recibidos')

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex border-b">
        <button
          onClick={() => setTab('recibidos')}
          className={cn(
            'px-5 py-3 text-sm font-medium transition-colors',
            tab === 'recibidos'
              ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Del empleador
        </button>
        <button
          onClick={() => setTab('solicitudes')}
          className={cn(
            'px-5 py-3 text-sm font-medium transition-colors',
            tab === 'solicitudes'
              ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Mis solicitudes
        </button>
      </div>

      {tab === 'recibidos' ? (
        <MisDocumentos employeeId={employeeId} />
      ) : (
        <div className="p-5">
          <MisSolicitudes />
        </div>
      )}
    </div>
  )
}
