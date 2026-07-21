import Link from 'next/link'
import { Users, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardData {
  totalEmpleados: number
  activos: number
  inactivos: number
  totalDocs: number
  enviadosAFirma: number
  pendientes: number
  rechazados: number
  firmados: number
}

const cardBase = 'rounded-xl border p-5 flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all duration-200'

export function KPICards({ data }: { data: Record<string, any> }) {
  const d = data as unknown as DashboardData

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Link href="/admin/empleados" className={cn(cardBase, 'bg-card border-border')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Empleados</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-blue-50 dark:bg-blue-950/30">
            <Users size={14} className="text-blue-500 dark:text-blue-400" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalEmpleados}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{d.activos} activos · {d.inactivos} inactivos</p>
      </Link>

      <Link href="/admin/documentos" className={cn(cardBase, 'bg-card border-border')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Documentos emitidos</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-purple-50 dark:bg-purple-950/30">
            <FileText size={14} className="text-purple-500 dark:text-purple-400" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalDocs}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {d.enviadosAFirma} enviados · {d.pendientes} sin enviar · {d.firmados} firmados · {d.rechazados} rechazados
        </p>
      </Link>
    </div>
  )
}
