interface KPI { label: string; value: number; color?: string }

export function KPICards({ data }: { data: Record<string, number> }) {
  const kpis: KPI[] = [
    { label: 'Total Empleados', value: data.totalEmpleados },
    { label: 'Activos', value: data.activos, color: 'text-green-700' },
    { label: 'Inactivos', value: data.inactivos, color: 'text-gray-500' },
    { label: 'Total Recibos', value: data.totalDocs },
    { label: 'Recibos Enviados', value: data.enviadosAFirma, color: 'text-blue-600' },
    { label: 'Pendientes', value: data.pendientes, color: 'text-yellow-600' },
    { label: 'Conformes', value: data.firmados, color: 'text-green-700' },
    { label: 'Disconformes', value: data.rechazados, color: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map(kpi => (
        <div key={kpi.label} className="bg-white rounded-lg border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
          <p className={`text-3xl font-bold mt-1 ${kpi.color ?? 'text-green-900'}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  )
}
