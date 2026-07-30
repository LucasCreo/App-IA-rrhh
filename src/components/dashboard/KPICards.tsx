import Link from 'next/link'
import { Users, FileText, Receipt, ClipboardList, ArrowUpRight } from 'lucide-react'
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
  totalRecibos: number
  pendingSolicitudesDoc: number
  pendingSolicitudesMod: number
  pendingAusencias: number
}

const cardBase = 'group relative rounded-xl border p-4 flex flex-col gap-2 hover:-translate-y-1 hover:shadow-md hover:border-green-500/60 transition-all duration-200'

function Arrow() {
  return (
    <ArrowUpRight
      size={14}
      className="absolute top-3 right-3 text-muted-foreground/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors"
    />
  )
}

export function KPICards({ data }: { data: Record<string, any> }) {
  const d = data as unknown as DashboardData
  const totalPendientes = (d.pendingAusencias ?? 0) + (d.pendingSolicitudesDoc ?? 0) + (d.pendingSolicitudesMod ?? 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <Link href="/admin/empleados?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-blue-50 dark:bg-blue-950/30">
            <Users size={14} className="text-blue-500 dark:text-blue-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Empleados</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalEmpleados}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{d.activos} activos · {d.inactivos} inactivos</p>
      </Link>

      <Link href="/admin/documentos?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-purple-50 dark:bg-purple-950/30">
            <FileText size={14} className="text-purple-500 dark:text-purple-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Documentos</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalDocs}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{d.firmados} firmados · {d.enviadosAFirma} enviados</p>
      </Link>

      <Link href="/admin/recibos?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-green-50 dark:bg-green-950/30">
            <Receipt size={14} className="text-green-600 dark:text-green-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Recibos</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalRecibos ?? 0}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">acumulado histórico</p>
      </Link>

      <Link href="/admin/solicitudes?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-amber-50 dark:bg-amber-950/30">
            <ClipboardList size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Pendientes</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{totalPendientes}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">solicitudes por revisar</p>
      </Link>
    </div>
  )
}
