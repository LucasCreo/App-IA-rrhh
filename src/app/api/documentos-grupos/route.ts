import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const tipoDocumentoId = searchParams.get('tipoDocumentoId') ? Number(searchParams.get('tipoDocumentoId')) : undefined
  const periodo = searchParams.get('periodo') ?? undefined
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = 50

  const scope = await getScopedEmployeeIds(user.userId)

  const createdRange: { gte?: Date; lte?: Date } = {}
  if (desde) createdRange.gte = new Date(`${desde}T00:00:00`)
  if (hasta) createdRange.lte = new Date(`${hasta}T23:59:59`)

  const where = {
    ...(q ? { nombreArchivo: { contains: q } } : {}),
    ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    ...(periodo ? { periodo: { contains: periodo } } : {}),
    ...(desde || hasta ? { createdAt: createdRange } : {}),
    ...(scope ? { asignaciones: { some: { employeeId: { in: [...scope] } } } } : {}),
  }

  const [total, grupos] = await Promise.all([
    prisma.documentoGrupo.count({ where }),
    prisma.documentoGrupo.findMany({
      where,
      include: {
        cargadoPor: { select: { email: true } },
        tipoDocumento: { select: { id: true, nombre: true, accion: true } },
        asignaciones: { select: { estado: true, firmaConforme: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const shaped = grupos.map(g => {
    const asigns = scope ? g.asignaciones.filter(a => scope.has(a.employeeId)) : g.asignaciones
    const total = asigns.length
    const firmados = asigns.filter(a => a.estado === 'FIRMADO').length
    const enFirma = asigns.filter(a => a.estado === 'ENVIADO_A_FIRMA').length
    const borradores = asigns.filter(a => a.estado === 'BORRADOR').length
    const rechazados = asigns.filter(a => a.estado === 'RECHAZADO').length
    const conformes = asigns.filter(a => a.estado === 'FIRMADO' && a.firmaConforme === true).length
    const noConformes = asigns.filter(a => a.estado === 'FIRMADO' && a.firmaConforme === false).length
    return {
      id: g.id,
      nombreArchivo: g.nombreArchivo,
      periodo: g.periodo,
      tipoDocumento: g.tipoDocumento,
      cargadoPor: g.cargadoPor,
      createdAt: g.createdAt,
      stats: { total, firmados, enFirma, borradores, rechazados, conformes, noConformes },
    }
  })

  return NextResponse.json({ grupos: shaped, total, page, pages: Math.ceil(total / limit) })
}
