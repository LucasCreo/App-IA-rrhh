import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { unlink } from 'fs/promises'

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

  const grupos = await prisma.documentoGrupo.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombreArchivo: true, filePath: true },
  })
  const found = new Set(grupos.map(g => g.id))

  const errors: Array<{ id: number; error: string }> = []
  let deleted = 0
  try {
    await prisma.documentoGrupo.deleteMany({ where: { id: { in: ids } } })
    deleted = grupos.length
    for (const id of ids) {
      if (!found.has(id)) errors.push({ id, error: 'Documento no encontrado' })
    }
    for (const g of grupos) {
      try { await unlink(g.filePath) } catch { /* no-op */ }
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
