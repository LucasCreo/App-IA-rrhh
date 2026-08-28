import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { deleteAditusFile } from '@/lib/aditus'
import { actualizarProgresoLote } from '@/lib/loteProgress'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; pendId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, pendId } = await params
  const loteId = Number(id)
  const pendienteId = Number(pendId)

  const pendiente = await prisma.loteArchivoPendiente.findUnique({ where: { id: pendienteId } })
  if (!pendiente || pendiente.loteId !== loteId) {
    return NextResponse.json({ error: 'Archivo pendiente no encontrado' }, { status: 404 })
  }

  // Para lotes SFTP: borramos también el registro de SftpArchivoProcesado
  // para que actualizarProgresoLote pueda transicionar el lote a LISTO si
  // ya no quedan pendientes.
  await prisma.sftpArchivoProcesado.deleteMany({ where: { pendienteId } })
  await prisma.loteArchivoPendiente.delete({ where: { id: pendienteId } })
  if (pendiente.aditusId) {
    try { await deleteAditusFile(pendiente.aditusId) } catch { /* best-effort */ }
  }
  await logAction(user.userId, 'ELIMINAR_PENDIENTE', 'Lote', `Lote ${loteId}: ${pendiente.nombreArchivo}`)
  await actualizarProgresoLote(loteId).catch(() => { /* best-effort */ })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; pendId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, pendId } = await params
  const loteId = Number(id)
  const pendienteId = Number(pendId)

  const body = await req.json().catch(() => ({}))
  const legajoDetectado: string | null = typeof body?.legajoDetectado === 'string' ? body.legajoDetectado : null

  const pendiente = await prisma.loteArchivoPendiente.findUnique({ where: { id: pendienteId } })
  if (!pendiente || pendiente.loteId !== loteId) {
    return NextResponse.json({ error: 'Archivo pendiente no encontrado' }, { status: 404 })
  }

  await prisma.loteArchivoPendiente.update({
    where: { id: pendienteId },
    data: { legajoDetectado, detectando: false },
  })
  return NextResponse.json({ ok: true })
}
