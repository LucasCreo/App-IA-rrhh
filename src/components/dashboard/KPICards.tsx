import { Users, FileText, Inbox, MessageSquare } from 'lucide-react'

interface DashboardData {
  totalEmpleados: number
  activos: number
  inactivos: number
  totalDocs: number
  enviadosAFirma: number
  pendientes: number
  rechazados: number
  firmados: number
  pendingSolicitudesDoc: number
  pendingSolicitudesMod: number
  solicitudesPorTipo: { nombre: string; cantidad: number }[]
  modificacionesPorEmpleado: { nombre: string; cantidad: number }[]
}

export function KPICards({ data }: { data: Record<string, any> }) {
  const d = data as unknown as DashboardData
  const solAlert = d.pendingSolicitudesDoc > 0
  const modAlert = d.pendingSolicitudesMod > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-xl border bg-card border-border p-5 flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Empleados</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-blue-50 dark:bg-blue-950/30">
            <Users size={14} className="text-blue-500 dark:text-blue-400" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalEmpleados}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{d.activos} activos · {d.inactivos} inactivos</p>
      </div>

      <div className="rounded-xl border bg-card border-border p-5 flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Recibos</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-purple-50 dark:bg-purple-950/30">
            <FileText size={14} className="text-purple-500 dark:text-purple-400" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{d.totalDocs}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {d.enviadosAFirma} enviados · {d.pendientes} sin enviar · {d.firmados} firmados · {d.rechazados} rechazados
        </p>
      </div>

      <div className={`rounded-xl border p-5 flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default ${solAlert ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Solicitudes</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-yellow-50 dark:bg-yellow-950/30">
            <Inbox size={14} className="text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${solAlert ? 'text-yellow-700 dark:text-yellow-400' : 'text-foreground'}`}>{d.pendingSolicitudesDoc}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {d.solicitudesPorTipo.length === 0
            ? 'Sin solicitudes pendientes'
            : d.solicitudesPorTipo.map(t => `${t.cantidad} ${t.nombre}`).join(' · ')}
        </p>
      </div>

      <div className={`rounded-xl border p-5 flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default ${modAlert ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-none">Modificaciones</span>
          <div className="p-1.5 rounded-lg shrink-0 bg-yellow-50 dark:bg-yellow-950/30">
            <MessageSquare size={14} className="text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${modAlert ? 'text-yellow-700 dark:text-yellow-400' : 'text-foreground'}`}>{d.pendingSolicitudesMod}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {d.modificacionesPorEmpleado.length === 0
            ? 'Sin modificaciones pendientes'
            : d.modificacionesPorEmpleado.map(m => m.cantidad > 1 ? `${m.nombre} (${m.cantidad})` : m.nombre).join(' · ')}
        </p>
      </div>
    </div>
  )
}
