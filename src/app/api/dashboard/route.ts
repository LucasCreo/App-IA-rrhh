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
    totalDocs, docsByEstado, empByCategoria,
    pendingSolicitudesDoc, pendingSolicitudesMod,
    recentSolicitudes, recentEmpleados,
    pendingSolList, pendingModList,
    pendingAusencias,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { estado: 'ACTIVO' } }),
    prisma.employee.count({ where: { estado: 'INACTIVO' } }),
    prisma.document.count(),
    prisma.document.groupBy({ by: ['estado'], _count: true }),
    prisma.employee.groupBy({ by: ['categoriaId'], _count: true, where: { estado: 'ACTIVO' } }),
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
      include: { categoria: { select: { nombre: true } } },
    }),
    prisma.solicitudDocumento.findMany({
      where: { estado: 'PENDIENTE' },
      select: { tipo: { select: { nombre: true } } },
    }),
    prisma.solicitudModificacion.findMany({
      where: { estado: 'PENDIENTE' },
      select: { employee: { select: { nombre: true, apellido: true } } },
    }),
    prisma.solicitudAusencia.count({ where: { estado: 'PENDIENTE' } }),
  ])

  const categories = await prisma.category.findMany()
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.nombre]))

  const documentsByEstado = Object.fromEntries(docsByEstado.map(d => [d.estado, d._count]))

  const solicitudesPorTipo = Object.entries(
    pendingSolList.reduce((acc: Record<string, number>, s) => {
      acc[s.tipo.nombre] = (acc[s.tipo.nombre] ?? 0) + 1
      return acc
    }, {})
  ).map(([nombre, cantidad]) => ({ nombre, cantidad }))

  const modificacionesPorEmpleado = Object.entries(
    pendingModList.reduce((acc: Record<string, number>, m) => {
      const nombre = `${m.employee.apellido}, ${m.employee.nombre}`
      acc[nombre] = (acc[nombre] ?? 0) + 1
      return acc
    }, {})
  ).map(([nombre, cantidad]) => ({ nombre, cantidad }))

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
    solicitudesPorTipo,
    modificacionesPorEmpleado,
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
      legajo: e.legajo,
      categoria: e.categoria.nombre,
      createdAt: e.createdAt,
    })),
    empleadosPorCategoria: empByCategoria.map(e => ({
      nombre: catMap[e.categoriaId] ?? 'N/A',
      cantidad: e._count,
    })),
    documentosPorEstado: [
      { name: 'Firmados', value: documentsByEstado['FIRMADO'] ?? 0, color: '#16a34a' },
      { name: 'Enviados', value: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0, color: '#2563eb' },
      { name: 'Borradores', value: documentsByEstado['BORRADOR'] ?? 0, color: '#6b7280' },
      { name: 'Rechazados', value: documentsByEstado['RECHAZADO'] ?? 0, color: '#dc2626' },
    ],
  })
}
