'use client'

import { useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { TabGeneral } from '@/components/configuracion/TabGeneral'
import { TabEmpleados } from '@/components/configuracion/TabEmpleados'
import { TabDocumentos } from '@/components/configuracion/TabDocumentos'
import { TabFirma } from '@/components/configuracion/TabFirma'
import { TabAuditoria } from '@/components/configuracion/TabAuditoria'
import { TabSolicitudes } from '@/components/configuracion/TabSolicitudes'
import { TabCalendario } from '@/components/configuracion/TabCalendario'
import { TabEvaluaciones } from '@/components/configuracion/TabEvaluaciones'
import { TabFormularios } from '@/components/configuracion/TabFormularios'
import { UsuariosPage } from '@/components/usuarios/UsuariosPage'
import { cn } from '@/lib/utils'

interface Props {
  puedeGestionarUsuarios?: boolean
  puedeVerAuditoria?: boolean
}

export function ConfiguracionClient({ puedeGestionarUsuarios, puedeVerAuditoria }: Props) {
  const [tab, setTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'empleados', label: 'Personal' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'firma', label: 'Firma' },
    { id: 'solicitudes', label: 'Solicitudes' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'evaluaciones', label: 'Evaluaciones' },
    { id: 'formularios', label: 'Formularios' },
    ...(puedeGestionarUsuarios ? [{ id: 'usuarios', label: 'Usuarios' }] : []),
    ...(puedeVerAuditoria ? [{ id: 'auditoria', label: 'Auditoría' }] : []),
  ]

  return (
    <>
      <AdminHeader title="Configuración" />
      <div className="p-6">
        <div className="flex border-b mb-6">
          {tabs.map(t => (
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
        {tab === 'general' && <TabGeneral />}
        {tab === 'empleados' && <TabEmpleados />}
        {tab === 'documentos' && <TabDocumentos />}
        {tab === 'firma' && <TabFirma />}
        {tab === 'solicitudes' && <TabSolicitudes />}
        {tab === 'calendario' && <TabCalendario />}
        {tab === 'evaluaciones' && <TabEvaluaciones />}
        {tab === 'formularios' && <TabFormularios />}
        {tab === 'usuarios' && <UsuariosPage />}
        {tab === 'auditoria' && <TabAuditoria />}
      </div>
    </>
  )
}
