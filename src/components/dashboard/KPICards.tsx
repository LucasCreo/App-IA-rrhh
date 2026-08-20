import Link from 'next/link'
import { Receipt, ClipboardList, FolderOpen, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardData {
  totalRecibos: number
  recibosPorEstado?: { name: string; value: number }[]
  totalDocs: number
  rechazados: number
  totalSolicitudes: number
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

function Badge({ count, title }: { count: number; title: string }) {
  if (count <= 0) return null
  return (
    <span
      className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center shadow-md z-10"
      title={title}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function KPICards({ data }: { data: Record<string, any> }) {
  const d = data as unknown as DashboardData
  const totalPendientes = (d.pendingAusencias ?? 0) + (d.pendingSolicitudesDoc ?? 0) + (d.pendingSolicitudesMod ?? 0)
  const recibosRechazados = d.recibosPorEstado?.find(r => r.name === 'Rechazados')?.value ?? 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <Link href="/admin/recibos?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Badge count={recibosRechazados} title={`${recibosRechazados} recibo(s) rechazado(s)`} />
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

      <Link href="/admin/documentos?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Badge count={d.rechazados ?? 0} title={`${d.rechazados ?? 0} documento(s) rechazado(s)`} />
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-blue-50 dark:bg-blue-950/30">
            <FolderOpen size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Documentos</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalDocs ?? 0}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">acumulado histórico</p>
      </Link>

      <Link href="/admin/solicitudes?from=dashboard" className={cn(cardBase, 'bg-card border-border')}>
        <Badge count={totalPendientes} title={`${totalPendientes} solicitud(es) pendiente(s)`} />
        <Arrow />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg shrink-0 bg-amber-50 dark:bg-amber-950/30">
            <ClipboardList size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Solicitudes</span>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalSolicitudes ?? 0}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">acumulado histórico</p>
      </Link>
    </div>
  )
}
