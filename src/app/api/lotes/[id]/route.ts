import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const lote = await prisma.lote.findUnique({
      where: { id: Number(id) },
      include: {
        tipoDocumento: { select: { id: true, nombre: true, accion: true } },
        documentos: { orderBy: { fechaCarga: 'desc' } },
        empleados: {
          include: {
            employee: {
              select: {
                id: true, nombre: true, apellido: true, legajo: true,
                categoria: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        pendientes: { orderBy: { uploadedAt: 'asc' } },
      },
    })

    if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

    const scope = await getScopedEmployeeIds(user.userId)
    if (scope && lote.empleados.length > 0 && !lote.empleados.some(le => scope.has(le.employeeId))) {
      return NextResponse.json({ error: 'No autorizado sobre este lote' }, { status: 403 })
    }

    // Roster implícito: empleados activos (scopeados) - los ya asignados aparecen con su doc
    const activos = await prisma.employee.findMany({
      where: {
        estado: 'ACTIVO',
        ...(scope ? { id: { in: [...scope] } } : {}),
      },
      select: {
        id: true, nombre: true, apellido: true, legajo: true,
        categoria: { select: { id: true, nombre: true } },
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    })

    const docByEmployee = new Map<number, any>()
    for (const doc of lote.documentos) {
      if (!docByEmployee.has(doc.employeeId)) {
        docByEmployee.set(doc.employeeId, doc)
      }
    }

    const empleadosConEstado = activos.map(e => ({
      ...e,
      documento: docByEmployee.get(e.id) ?? null,
    }))

    const allDocs = [...docByEmployee.values()]
    const stats = {
      total: activos.length,
      firmados: allDocs.filter(d => d.estado === 'FIRMADO').length,
      enFirma: allDocs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
      borradores: allDocs.filter(d => d.estado === 'BORRADOR').length,
      errores: allDocs.filter(d => d.estado === 'ERROR').length,
      rechazados: allDocs.filter(d => d.estado === 'RECHAZADO').length,
      sinRecibo: activos.filter(e => !docByEmployee.has(e.id)).length,
      pendientes: lote.pendientes.length,
    }

    const { documentos: _omit, empleados: _omit2, pendientes, ...loteInfo } = lote
    return NextResponse.json({ lote: loteInfo, empleados: empleadosConEstado, pendientes, stats })
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

    const body = await req.json()
    const { nombre, descripcion } = body

    const loteId = Number(id)
    const data: any = {}

    if (typeof nombre === 'string') {
      if (!nombre.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
      data.nombre = nombre.trim()
    }
    if ('descripcion' in body) {
      data.descripcion = descripcion?.trim() || null
    }

    if (Object.keys(data).length > 0) {
      await prisma.lote.update({ where: { id: loteId }, data })
    }

    await logAction(user.userId, 'EDITAR_LOTE', 'Lote', data.nombre ?? `ID ${loteId}`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
