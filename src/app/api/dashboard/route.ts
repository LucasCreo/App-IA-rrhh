import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [
    totalEmpleados, activos, inactivos,
    totalDocs, docsByEstado, empByCategoria,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { estado: 'ACTIVO' } }),
    prisma.employee.count({ where: { estado: 'INACTIVO' } }),
    prisma.document.count(),
    prisma.document.groupBy({ by: ['estado'], _count: true }),
    prisma.employee.groupBy({ by: ['categoriaId'], _count: true, where: { estado: 'ACTIVO' } }),
  ])

  const categories = await prisma.category.findMany()
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.nombre]))

  const documentsByEstado = Object.fromEntries(docsByEstado.map(d => [d.estado, d._count]))

  return NextResponse.json({
    totalEmpleados,
    activos,
    inactivos,
    totalDocs,
    pendientes: documentsByEstado['PENDIENTE_ENVIO'] ?? 0,
    enviadosAFirma: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0,
    firmados: documentsByEstado['FIRMADO'] ?? 0,
    rechazados: documentsByEstado['RECHAZADO'] ?? 0,
    borradores: documentsByEstado['BORRADOR'] ?? 0,
    empleadosPorCategoria: empByCategoria.map(e => ({
      nombre: catMap[e.categoriaId] ?? 'N/A',
      cantidad: e._count,
    })),
    documentosPorEstado: [
      { name: 'Firmados', value: documentsByEstado['FIRMADO'] ?? 0, color: '#16a34a' },
      { name: 'Enviados', value: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0, color: '#2563eb' },
      { name: 'Pendientes', value: documentsByEstado['PENDIENTE_ENVIO'] ?? 0, color: '#ca8a04' },
      { name: 'Borradores', value: documentsByEstado['BORRADOR'] ?? 0, color: '#6b7280' },
      { name: 'Rechazados', value: documentsByEstado['RECHAZADO'] ?? 0, color: '#dc2626' },
    ],
  })
}
