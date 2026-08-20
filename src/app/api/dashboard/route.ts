import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.VER_DASHBOARD)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      email: true,
      avatarUrl: true,
      avatarBgColor: true,
      avatarTextColor: true,
      employee: { select: { nombre: true, apellido: true } },
    },
  })

  const [
    totalEmpleados, activos, inactivos,
    totalDocs, docsByEstado, empByArea,
    pendingSolicitudesDoc, pendingSolicitudesMod,
    recentSolicitudes, recentEmpleados,
    pendingAusencias,
    totalRecibos, recibosByEstado,
    recentPendAusencias,
    recentPendMods,
    solDocByEstado, solAusByEstado,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { estado: 'ACTIVO' } }),
    prisma.employee.count({ where: { estado: 'INACTIVO' } }),
    prisma.documentoGrupo.count(),
    prisma.documentoAsignacion.groupBy({ by: ['estado'], _count: true }),
    prisma.employee.groupBy({ by: ['areaId'], _count: true, where: { estado: 'ACTIVO' } }),
    prisma.solicitudDocumento.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudModificacion.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudDocumento.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { employee: { select: { nombre: true, apellido: true, legajo: true } }, tipo: { select: { nombre: true } } },
    }),
    prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        categoria: { select: { nombre: true } },
        user: { select: { avatarUrl: true, avatarBgColor: true, avatarTextColor: true } },
      },
    }),
    prisma.solicitudAusencia.count({ where: { estado: 'PENDIENTE' } }),
    prisma.document.count({ where: { tipoDocumento: { is: { nombre: 'Recibo de Sueldo' } } } }),
    prisma.document.groupBy({ by: ['estado'], _count: true, where: { tipoDocumento: { is: { nombre: 'Recibo de Sueldo' } } } }),
    prisma.solicitudAusencia.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        employee: { select: { nombre: true, apellido: true, legajo: true } },
        tipoAusencia: { select: { nombre: true } },
      },
    }),
    prisma.solicitudModificacion.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      },
    }),
    prisma.solicitudDocumento.groupBy({ by: ['estado'], _count: true }),
    prisma.solicitudAusencia.groupBy({ by: ['estado'], _count: true }),
  ])

  const [totalSolDoc, totalSolMod, totalSolAus, totalRespFormularios] = await Promise.all([
    prisma.solicitudDocumento.count(),
    prisma.solicitudModificacion.count(),
    prisma.solicitudAusencia.count(),
    prisma.respuestaFormulario.count(),
  ])
  const totalSolicitudes = totalSolDoc + totalSolMod + totalSolAus + totalRespFormularios

  const areas = await prisma.area.findMany()
  const areaMap = Object.fromEntries(areas.map(a => [a.id, a.nombre]))

  const documentsByEstado = Object.fromEntries(docsByEstado.map(d => [d.estado, d._count]))
  const recibosByEstadoMap = Object.fromEntries(recibosByEstado.map(d => [d.estado, d._count]))

  const pendientesRevision = [
    ...recentSolicitudes.map(s => ({
      id: `sol-${s.id}`,
      tipo: 'documento' as const,
      empleado: `${s.employee.apellido}, ${s.employee.nombre}`,
      legajo: s.employee.legajo,
      descripcion: `Solicita: ${s.tipo.nombre}`,
      createdAt: s.createdAt,
      href: '/admin/solicitudes?from=dashboard',
    })),
    ...recentPendAusencias.map(a => ({
      id: `aus-${a.id}`,
      tipo: 'ausencia' as const,
      empleado: `${a.employee.apellido}, ${a.employee.nombre}`,
      legajo: a.employee.legajo,
      descripcion: `Ausencia: ${a.tipoAusencia.nombre} (${a.dias} día${a.dias === 1 ? '' : 's'})`,
      createdAt: a.createdAt,
      href: '/admin/solicitudes?from=dashboard',
    })),
    ...recentPendMods.map(m => ({
      id: `mod-${m.id}`,
      tipo: 'modificacion' as const,
      empleado: `${m.employee.apellido}, ${m.employee.nombre}`,
      legajo: m.employee.legajo,
      descripcion: 'Solicita modificar sus datos personales',
      createdAt: m.createdAt,
      href: `/admin/empleados/${m.employee.id}?from=dashboard`,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)

  return NextResponse.json({
    me: {
      nombre: me?.employee?.nombre ?? me?.email?.split('@')[0] ?? 'Admin',
      apellido: me?.employee?.apellido ?? '',
      email: me?.email ?? '',
      avatarUrl: me?.avatarUrl ?? null,
      avatarBgColor: me?.avatarBgColor ?? null,
      avatarTextColor: me?.avatarTextColor ?? null,
    },
    pendingAusencias,
    totalEmpleados,
    activos,
    inactivos,
    totalDocs,
    pendientes: (documentsByEstado['BORRADOR'] ?? 0) + (documentsByEstado['ERROR'] ?? 0),
    enviadosAFirma: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0,
    firmados: documentsByEstado['FIRMADO'] ?? 0,
    rechazados: documentsByEstado['RECHAZADO'] ?? 0,
    borradores: documentsByEstado['BORRADOR'] ?? 0,
    pendingSolicitudesDoc,
    pendingSolicitudesMod,
    totalSolicitudes,
    totalRecibos,
    pendientesRevision,
    recentSolicitudes: recentSolicitudes.map(s => ({
      id: s.id,
      empleado: `${s.employee.apellido}, ${s.employee.nombre}`,
      legajo: s.employee.legajo,
      tipo: s.tipo.nombre,
      createdAt: s.createdAt,
    })),
    recentEmpleados: recentEmpleados.map(e => ({
      id: e.id,
      nombre: `${e.apellido}, ${e.nombre}`,
      iniciales: `${e.nombre[0] ?? ''}${e.apellido[0] ?? ''}`.toUpperCase(),
      legajo: e.legajo,
      categoria: e.categoria.nombre,
      createdAt: e.createdAt,
      avatarUrl: e.user?.avatarUrl ?? null,
      avatarBgColor: e.user?.avatarBgColor ?? null,
      avatarTextColor: e.user?.avatarTextColor ?? null,
    })),
    empleadosPorArea: empByArea.map(e => ({
      nombre: areaMap[e.areaId] ?? 'N/A',
      cantidad: e._count,
    })),
    recibosPorEstado: [
      { name: 'Firmados', value: recibosByEstadoMap['FIRMADO'] ?? 0, color: '#16a34a' },
      { name: 'Enviados', value: recibosByEstadoMap['ENVIADO_A_FIRMA'] ?? 0, color: '#2563eb' },
      { name: 'Borradores', value: recibosByEstadoMap['BORRADOR'] ?? 0, color: '#6b7280' },
      { name: 'Rechazados', value: recibosByEstadoMap['RECHAZADO'] ?? 0, color: '#dc2626' },
    ],
    solicitudesPorEstado: (() => {
      const doc = Object.fromEntries(solDocByEstado.map(d => [d.estado, d._count]))
      const aus = Object.fromEntries(solAusByEstado.map(d => [d.estado, d._count]))
      const pend = (doc['PENDIENTE'] ?? 0) + (aus['PENDIENTE'] ?? 0) + pendingSolicitudesMod
      const apro = (doc['APROBADO'] ?? 0) + (aus['APROBADA'] ?? 0)
      const rech = (doc['RECHAZADO'] ?? 0) + (aus['RECHAZADA'] ?? 0)
      return [
        { name: 'Pendientes', value: pend, color: '#ca8a04' },
        { name: 'Aprobadas', value: apro, color: '#16a34a' },
        { name: 'Rechazadas', value: rech, color: '#dc2626' },
      ]
    })(),
  })
}
