import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [lote, empleados, descRows] = await Promise.all([
    (prisma as any).lote.findUnique({
      where: { id: Number(id) },
      include: {
        tipoDocumento: { select: { id: true, nombre: true } },
        documentos: { orderBy: { fechaCarga: 'desc' } },
      },
    }),
    prisma.employee.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true, nombre: true, apellido: true, legajo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.$queryRawUnsafe<Array<{ descripcion: string | null }>>(
      `SELECT descripcion FROM Lote WHERE id = ${Number(id)}`
    ),
  ])

  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

  const docByEmployee = new Map<number, any>()
  for (const doc of lote.documentos) {
    if (!docByEmployee.has(doc.employeeId)) {
      docByEmployee.set(doc.employeeId, doc)
    }
  }

  const empleadosConEstado = empleados.map(e => ({
    ...e,
    documento: docByEmployee.get(e.id) ?? null,
  }))

  const allDocs = [...docByEmployee.values()]
  const stats = {
    total: empleados.length,
    firmados: allDocs.filter(d => d.estado === 'FIRMADO').length,
    enFirma: allDocs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
    borradores: allDocs.filter(d => d.estado === 'BORRADOR').length,
    errores: allDocs.filter(d => d.estado === 'ERROR').length,
    rechazados: allDocs.filter(d => d.estado === 'RECHAZADO').length,
    sinRecibo: empleados.filter(e => !docByEmployee.has(e.id)).length,
  }

  const { documentos: _omit, ...loteInfo } = lote
  return NextResponse.json({
    lote: { ...loteInfo, descripcion: descRows[0]?.descripcion ?? null },
    empleados: empleadosConEstado,
    stats,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const n = nombre.trim()
  const desc: string | null = descripcion?.trim() || null

  await prisma.$executeRawUnsafe(
    `UPDATE Lote SET nombre = @p1, descripcion = @p2 WHERE id = @p3`,
    n, desc, Number(id)
  )

  await logAction(user.userId, 'EDITAR_LOTE', 'Lote', n)
  return NextResponse.json({ id: Number(id), nombre: n, descripcion: desc })
}
