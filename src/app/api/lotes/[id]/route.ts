import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const [lote, empleados] = await Promise.all([
      prisma.lote.findUnique({
        where: { id: Number(id) },
        include: {
          tipoDocumento: { select: { id: true, nombre: true, accion: true } },
          documentos: { orderBy: { fechaCarga: 'desc' } },
        },
      }),
      prisma.employee.findMany({
        where: { estado: 'ACTIVO' },
        select: { id: true, nombre: true, apellido: true, legajo: true },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      }),
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
    return NextResponse.json({ lote: loteInfo, empleados: empleadosConEstado, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const lote = await prisma.lote.findUnique({ where: { id: Number(id) }, select: { nombre: true } })
    if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

    await prisma.$transaction([
      prisma.document.updateMany({ where: { loteId: Number(id) }, data: { loteId: null } }),
      prisma.lote.delete({ where: { id: Number(id) } }),
    ])

    await logAction(user.userId, 'ELIMINAR_LOTE', 'Lote', lote.nombre)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { nombre, descripcion } = await req.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const n = nombre.trim()
    const desc: string | null = descripcion?.trim() || null

    await prisma.lote.update({
      where: { id: Number(id) },
      data: { nombre: n, descripcion: desc },
    })

    await logAction(user.userId, 'EDITAR_LOTE', 'Lote', n)
    return NextResponse.json({ id: Number(id), nombre: n, descripcion: desc })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
