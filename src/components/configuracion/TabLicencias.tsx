'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TabTipos as TabTiposAusencia } from '@/components/ausencias/AusenciasAdmin'

export function TabLicencias() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipos de licencia</CardTitle>
          <CardDescription className="mt-1">
            Definí los tipos de licencia (vacaciones, enfermedad, etc.) que pueden solicitar los empleados. Marcá cuáles requieren aprobación y cuáles afectan el saldo anual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabTiposAusencia />
        </CardContent>
      </Card>
    </div>
  )
}
