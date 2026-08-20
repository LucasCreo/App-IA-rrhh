import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { deleteAditusFile } from '@/lib/aditus'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const idsRaw = body?.ids
  if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
    return NextResponse.json({ error: 'ids requerido' }, { status: 400 })
  }
  const ids = idsRaw.map(Number).filter(n => Number.isInteger(n) && n > 0)
  if (ids.length === 0) return NextResponse.json({ error: 'ids inválidos' }, { status: 400 })

  // Scope: si el usuario está limitado a un subárbol, solo puede tocar grupos
  // cuyas asignaciones sean todas de empleados dentro de su scope.
  const scope = await getScopedEmployeeIds(user.userId)
  let allowedIds = ids
  if (scope) {
    const gruposConAsignaciones = await prisma.documentoGrupo.findMany({
      where: { id: { in: ids } },
      select: { id: true, asignaciones: { select: { employeeId: true } } },
    })
    allowedIds = gruposConAsignaciones
      .filter(g => g.asignaciones.every(a => scope.has(a.employeeId)))
      .map(g => g.id)
    if (allowedIds.length === 0) {
      return NextResponse.json({ error: 'No tenés permiso sobre ninguno de los documentos seleccionados', deleted: 0, errors: [] }, { status: 403 })
    }
  }

  const grupos = await prisma.documentoGrupo.findMany({
    where: { id: { in: allowedIds } },
    select: { id: true, nombreArchivo: true, aditusId: true },
  })
  const found = new Set(grupos.map(g => g.id))

  const errors: Array<{ id: number; error: string }> = []
  let deleted = 0
  try {
    await prisma.documentoGrupo.deleteMany({ where: { id: { in: allowedIds } } })
    deleted = grupos.length
    for (const id of ids) {
      if (!found.has(id)) errors.push({ id, error: allowedIds.includes(id) ? 'Documento no encontrado' : 'Fuera de tu alcance' })
    }
    for (const g of grupos) {
      if (g.aditusId) {
        try { await deleteAditusFile(g.aditusId) } catch { /* best-effort */ }
      }
      await logAction(user.userId, 'ELIMINAR_DOCUMENTO_GRUPO', 'Documento', `Grupo ${g.id}: ${g.nombreArchivo}`)
    }
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Error interno al eliminar los documentos',
      deleted: 0,
      errors: ids.map(id => ({ id, error: 'No se pudo eliminar' })),
    }, { status: 500 })
  }

  return NextResponse.json({ deleted, errors })
}
