import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { FileText, Clock, Send, CalendarDays, Tag, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function EmpleadoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const [employee, totalRecibos, totalSolicitudes, solicitudesPendientes, ultimosRecibos, ultimasSolicitudes] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      include: { categoria: true },
    }),
    prisma.document.count({ where: { employeeId: decoded.employeeId, estado: { not: 'BORRADOR' } } }),
    prisma.solicitudDocumento.count({ where: { employeeId: decoded.employeeId } }),
    prisma.solicitudDocumento.count({ where: { employeeId: decoded.employeeId, estado: 'PENDIENTE' } }),
    prisma.document.findMany({
      where: { employeeId: decoded.employeeId, estado: { not: 'BORRADOR' } },
      orderBy: { fechaCarga: 'desc' },
      take: 3,
    }),
    prisma.solicitudDocumento.findMany({
      where: { employeeId: decoded.employeeId },
      include: { tipo: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ])
  if (!employee) redirect('/login')

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Inicio</h1>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Bienvenida */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-xl font-bold shrink-0 select-none text-green-700 dark:text-green-400">
              {`${employee.nombre[0]}${employee.apellido[0]}`.toUpperCase()}
            </div>
            <div>
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
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <Link href="/empleado/recibos" className="rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <FileText size={18} className="mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalRecibos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recibos</p>
          </Link>
          <Link href="/empleado/documentos" className="rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <Send size={18} className="mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalSolicitudes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Documentos enviados</p>
          </Link>
          <Link href="/empleado/documentos" className={cn(
            'rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md transition-shadow',
            solicitudesPendientes > 0 && 'border-yellow-400 dark:border-yellow-600'
          )}>
            <Clock size={18} className={cn('mx-auto mb-1.5', solicitudesPendientes > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
            <p className={cn('text-2xl font-bold', solicitudesPendientes > 0 && 'text-yellow-600 dark:text-yellow-400')}>
              {solicitudesPendientes}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Solicitudes pendientes</p>
          </Link>
        </div>

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

        {/* Últimas solicitudes */}
        {ultimasSolicitudes.length > 0 && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={15} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm">Documentos recientes</h3>
              </div>
              <Link href="/empleado/documentos" className="text-xs text-green-700 dark:text-green-400 hover:underline flex items-center gap-0.5">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y">
              {ultimasSolicitudes.map(s => (
                <div key={s.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                  <span>{s.tipo.nombre}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
