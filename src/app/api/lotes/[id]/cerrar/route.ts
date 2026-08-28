import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

/**
 * Cierra manualmente un lote (bloqueando ingesta posterior de archivos
 * SFTP para el mismo mes; el próximo archivo del mismo mes creará un
 * lote nuevo).
 *
 * Solo permitido cuando el lote no está PROCESANDO (para evitar cerrar
 * a la mitad de una ingesta).
 */
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const loteId = Number(id)
  if (!Number.isFinite(loteId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const lote = await prisma.lote.findUnique({ where: { id: loteId }, select: { id: true, nombre: true, estado: true } })
  if (!lote) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (lote.estado === 'CERRADO') return NextResponse.json({ ok: true, alreadyClosed: true })
  if (lote.estado === 'PROCESANDO') {
    return NextResponse.json({ error: 'El lote está en procesamiento; esperá a que termine' }, { status: 409 })
  }

  await prisma.lote.update({ where: { id: loteId }, data: { estado: 'CERRADO' } })
  await logAction(user.userId, 'CERRAR_LOTE', 'Lote', `${lote.nombre} (id=${loteId})`)
  return NextResponse.json({ ok: true })
}
