'use client'

import { useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { TabGeneral } from '@/components/configuracion/TabGeneral'
import { TabEmpleados } from '@/components/configuracion/TabEmpleados'
import { TabDocumentos } from '@/components/configuracion/TabDocumentos'
import { TabFirma } from '@/components/configuracion/TabFirma'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'empleados', label: 'Empleados' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'firma', label: 'Firma' },
]

export default function ConfiguracionPage() {
  const [tab, setTab] = useState('general')

  return (
    <>
      <AdminHeader title="Configuración" />
      <div className="p-6 max-w-3xl">
        <div className="flex border-b mb-6">
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
        {tab === 'general' && <TabGeneral />}
        {tab === 'empleados' && <TabEmpleados />}
        {tab === 'documentos' && <TabDocumentos />}
        {tab === 'firma' && <TabFirma />}
      </div>
    </>
  )
}
