'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MisDocumentos } from './MisDocumentos'
import { MisSolicitudes } from './MisSolicitudes'
import { MisEvaluaciones } from './MisEvaluaciones'
import { MisFormularios } from './MisFormularios'
import { cn } from '@/lib/utils'

type Tab = 'recibidos' | 'solicitudes' | 'evaluaciones' | 'formularios'

interface Props { employeeId: number }

export function DocumentosEmpleadoTabs({ employeeId }: Props) {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) ?? 'recibidos'
  const [tab, setTab] = useState<Tab>(initialTab)

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
          Recibidos
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
        <button
          onClick={() => setTab('evaluaciones')}
          className={cn(
            'px-5 py-3 text-sm font-medium transition-colors',
            tab === 'evaluaciones'
              ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Mis evaluaciones
        </button>
        <button
          onClick={() => setTab('formularios')}
          className={cn(
            'px-5 py-3 text-sm font-medium transition-colors',
            tab === 'formularios'
              ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Formularios
        </button>
      </div>

      {tab === 'recibidos' && <MisDocumentos employeeId={employeeId} />}
      {tab === 'solicitudes' && (
        <div className="p-5">
          <MisSolicitudes />
        </div>
      )}
      {tab === 'evaluaciones' && (
        <div className="p-5">
          <MisEvaluaciones />
        </div>
      )}
      {tab === 'formularios' && (
        <div className="p-5">
          <MisFormularios />
        </div>
      )}
    </div>
  )
}
