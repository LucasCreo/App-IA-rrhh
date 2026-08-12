import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { FileText, Send, CalendarDays, Tag, ChevronRight, IdCard, ArrowUpRight, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { ProximosEventos } from '@/components/calendario/ProximosEventos'
import { TourEmpleado } from '@/components/empleado/TourEmpleado'
import { UltimosPostsWidget } from '@/components/portal/UltimosPostsWidget'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'

export default async function EmpleadoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const RECIBO_TIPO = 'Recibo de Sueldo'
  const [employee, dbUser, totalRecibos, recibosPendientes, totalSolicitudes, formulariosPendientes, totalDocumentos, documentosPendientes, ultimosRecibos] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      include: { categoria: true },
    }),
    prisma.user.findUnique({ where: { employeeId: decoded.employeeId }, select: { avatarUrl: true, avatarBgColor: true, avatarTextColor: true } }),
    prisma.document.count({ where: { employeeId: decoded.employeeId, estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO'] }, tipoDocumento: { nombre: RECIBO_TIPO } } }),
    prisma.document.count({ where: { employeeId: decoded.employeeId, estado: 'ENVIADO_A_FIRMA', tipoDocumento: { nombre: RECIBO_TIPO } } }),
    prisma.solicitudDocumento.count({ where: { employeeId: decoded.employeeId } }),
    prisma.respuestaFormulario.count({ where: { employeeId: decoded.employeeId, estado: 'PENDIENTE' } }),
    prisma.documentoAsignacion.count({
      where: {
        employeeId: decoded.employeeId,
        estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO'] },
      },
    }),
    prisma.documentoAsignacion.count({
      where: {
        employeeId: decoded.employeeId,
        estado: 'ENVIADO_A_FIRMA',
      },
    }),
    prisma.document.findMany({
      where: { employeeId: decoded.employeeId, estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO'] }, tipoDocumento: { nombre: RECIBO_TIPO } },
      orderBy: { fechaCarga: 'desc' },
      take: 3,
    }),
  ])
  if (!employee) redirect('/login')

  return (
    <div className="flex flex-col h-full">
      <TourEmpleado />
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Inicio</h1>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Bienvenida */}
        <Link
          href="/empleado/mi-legajo"
          className="block rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-green-500/60 transition-all group"
        >
          <div className="flex items-center gap-4">
            <AvatarDisplay
              iniciales={`${employee.nombre[0]}${employee.apellido[0]}`}
              avatarUrl={dbUser?.avatarUrl ?? null}
              bgColor={dbUser?.avatarBgColor ?? null}
              textColor={dbUser?.avatarTextColor ?? null}
              size={56}
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-green-700 dark:text-green-400">Bienvenido, {employee.nombre}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Tag size={12} /> {employee.categoria.nombre}</span>
                <span>·</span>
                <span className={employee.estado === 'ACTIVO' ? 'text-green-600 dark:text-green-400' : 'text-red-600'}>{employee.estado}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays size={12} />
                Ingresó el {new Date(employee.fechaIngreso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
              <IdCard size={13} /> Mi legajo <ChevronRight size={12} />
            </span>
          </div>
        </Link>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link href="/empleado/recibos" className="group relative rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md hover:border-green-500/60 transition-all">
            {recibosPendientes > 0 && (
              <span
                className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center shadow-md"
                title={`${recibosPendientes} pendiente${recibosPendientes === 1 ? '' : 's'} de firma`}
              >
                {recibosPendientes > 99 ? '99+' : recibosPendientes}
              </span>
            )}
            <ArrowUpRight size={14} className="absolute top-3 right-3 text-muted-foreground/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            <FileText size={18} className="mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalRecibos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recibos</p>
          </Link>
          <Link href="/empleado/documentos" className="group relative rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md hover:border-green-500/60 transition-all">
            {documentosPendientes > 0 && (
              <span
                className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center shadow-md"
                title={`${documentosPendientes} documento${documentosPendientes === 1 ? '' : 's'} pendiente${documentosPendientes === 1 ? '' : 's'}`}
              >
                {documentosPendientes > 99 ? '99+' : documentosPendientes}
              </span>
            )}
            <ArrowUpRight size={14} className="absolute top-3 right-3 text-muted-foreground/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            <FolderOpen size={18} className="mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalDocumentos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Documentos</p>
          </Link>
          <Link href="/empleado/solicitudes" className="group relative rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md hover:border-green-500/60 transition-all">
            {formulariosPendientes > 0 && (
              <span
                className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center shadow-md"
                title={`${formulariosPendientes} formulario${formulariosPendientes === 1 ? '' : 's'} pendiente${formulariosPendientes === 1 ? '' : 's'}`}
              >
                {formulariosPendientes > 99 ? '99+' : formulariosPendientes}
              </span>
            )}
            <ArrowUpRight size={14} className="absolute top-3 right-3 text-muted-foreground/40 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
            <Send size={18} className="mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalSolicitudes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Solicitudes</p>
          </Link>
        </div>

        <UltimosPostsWidget baseHref="/empleado/portal" />

        {/* Últimos recibos */}
        {ultimosRecibos.length > 0 && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm">Recibos recientes</h3>
              </div>
              <Link href="/empleado/recibos" className="text-xs text-green-700 dark:text-green-400 hover:underline flex items-center gap-0.5">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y">
              {ultimosRecibos.map(r => (
                <div key={r.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-mono text-muted-foreground">{r.periodo}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.fechaCarga).toLocaleDateString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Próximos eventos */}
        <ProximosEventos href="/empleado/calendario" />
      </div>
    </div>
  )
}
