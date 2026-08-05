'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { TabGeneral } from '@/components/configuracion/TabGeneral'
import { TabEmpleados } from '@/components/configuracion/TabEmpleados'
import { TabDocsSolicitudes } from '@/components/configuracion/TabDocsSolicitudes'
import { TabLicencias } from '@/components/configuracion/TabLicencias'
import { TabAuditoria } from '@/components/configuracion/TabAuditoria'
import { TabCalendario } from '@/components/configuracion/TabCalendario'
import { TabEvaluaciones } from '@/components/configuracion/TabEvaluaciones'
import { TabEmails } from '@/components/configuracion/TabEmails'
import { UsuariosPage } from '@/components/usuarios/UsuariosPage'
import { cn } from '@/lib/utils'
import { EVALUACIONES_ENABLED } from '@/lib/features'

interface Props {
  puedeGestionarUsuarios?: boolean
  puedeVerAuditoria?: boolean
}

export function ConfiguracionClient({ puedeGestionarUsuarios, puedeVerAuditoria }: Props) {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'general')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setTab(t)
  }, [searchParams])

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'empleados', label: 'Legajos' },
    { id: 'docs-solicitudes', label: 'Documentos y solicitudes' },
    { id: 'licencias', label: 'Licencias' },
    { id: 'calendario', label: 'Calendario' },
    ...(EVALUACIONES_ENABLED ? [{ id: 'evaluaciones', label: 'Evaluaciones' }] : []),
    { id: 'emails', label: 'Emails' },
    ...(puedeGestionarUsuarios ? [{ id: 'usuarios', label: 'Usuarios' }] : []),
    ...(puedeVerAuditoria ? [{ id: 'auditoria', label: 'Auditoría' }] : []),
  ]

  return (
    <>
      <AdminHeader title="Configuración" />
      <div className="p-4 sm:p-6">
        <div className="flex border-b mb-6 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'cursor-pointer px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'general' && <TabGeneral />}
        {tab === 'empleados' && <TabEmpleados />}
        {tab === 'docs-solicitudes' && <TabDocsSolicitudes />}
        {tab === 'licencias' && <TabLicencias />}
        {tab === 'calendario' && <TabCalendario />}
        {EVALUACIONES_ENABLED && tab === 'evaluaciones' && <TabEvaluaciones />}
        {tab === 'emails' && <TabEmails />}
        {tab === 'usuarios' && <UsuariosPage />}
        {tab === 'auditoria' && <TabAuditoria />}
      </div>
    </>
  )
}
