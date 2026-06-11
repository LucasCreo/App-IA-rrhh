import { Users, UserCheck, UserX, FileText, Send, Clock, CheckCircle, XCircle } from 'lucide-react'

interface KpiData {
  totalEmpleados: number
  activos: number
  inactivos: number
  totalDocs: number
  enviadosAFirma: number
  pendientes: number
  firmados: number
  rechazados: number
}

const CARDS = [
  { label: 'Total Empleados', value: (d: KpiData) => d.totalEmpleados, icon: Users, iconBg: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-500 dark:text-blue-400' },
  { label: 'Activos', value: (d: KpiData) => d.activos, icon: UserCheck, iconBg: 'bg-green-50 dark:bg-green-950/30', iconColor: 'text-green-600 dark:text-green-400' },
  { label: 'Inactivos', value: (d: KpiData) => d.inactivos, icon: UserX, iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
  { label: 'Total Recibos', value: (d: KpiData) => d.totalDocs, icon: FileText, iconBg: 'bg-purple-50 dark:bg-purple-950/30', iconColor: 'text-purple-500 dark:text-purple-400' },
  { label: 'Enviados a Firma', value: (d: KpiData) => d.enviadosAFirma, icon: Send, iconBg: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-500 dark:text-blue-400' },
  { label: 'Pendientes', value: (d: KpiData) => d.pendientes, icon: Clock, iconBg: 'bg-yellow-50 dark:bg-yellow-950/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
  { label: 'Firmados', value: (d: KpiData) => d.firmados, icon: CheckCircle, iconBg: 'bg-green-50 dark:bg-green-950/30', iconColor: 'text-green-600 dark:text-green-400' },
  { label: 'Rechazados', value: (d: KpiData) => d.rechazados, icon: XCircle, iconBg: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-500 dark:text-red-400' },
]

export function KPICards({ data }: { data: Record<string, number> }) {
  const d = data as unknown as KpiData

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {CARDS.map(card => (
        <div key={card.label} className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">{card.label}</span>
            <div className={`p-1.5 rounded-lg shrink-0 ${card.iconBg}`}>
              <card.icon size={14} className={card.iconColor} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{card.value(d)}</p>
        </div>
      ))}
    </div>
  )
}
