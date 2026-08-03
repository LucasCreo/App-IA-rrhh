'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TabTipos as TabTiposAusencia } from '@/components/ausencias/AusenciasAdmin'

export function TabLicencias() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipos de ausencia</CardTitle>
          <CardDescription className="mt-1">
            Definí los tipos de ausencia (vacaciones, licencias, etc.) que pueden solicitar los empleados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabTiposAusencia />
        </CardContent>
      </Card>
    </div>
  )
}
