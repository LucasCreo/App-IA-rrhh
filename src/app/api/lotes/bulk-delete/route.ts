import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const idsRaw = body?.ids
  if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
    return NextResponse.json({ error: 'ids requerido' }, { status: 400 })
  }
  const ids = idsRaw.map(Number).filter(n => Number.isInteger(n) && n > 0)
  if (ids.length === 0) return NextResponse.json({ error: 'ids inválidos' }, { status: 400 })

  const lotes = await prisma.lote.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
  const found = new Set(lotes.map(l => l.id))

  const errors: Array<{ id: number; error: string }> = []
  let deleted = 0
  try {
    await prisma.$transaction([
      prisma.document.updateMany({ where: { loteId: { in: ids } }, data: { loteId: null } }),
      prisma.lote.deleteMany({ where: { id: { in: ids } } }),
    ])
    deleted = lotes.length
    for (const id of ids) {
      if (!found.has(id)) errors.push({ id, error: 'Lote no encontrado' })
    }
    for (const l of lotes) {
      await logAction(user.userId, 'ELIMINAR_LOTE', 'Lote', l.nombre)
    }
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Error interno al eliminar los lotes',
      deleted: 0,
      errors: ids.map(id => ({ id, error: 'No se pudo eliminar' })),
    }, { status: 500 })
  }

  return NextResponse.json({ deleted, errors })
}
