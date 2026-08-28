import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'

/**
 * Quita a un empleado del DocumentoGrupo (elimina su asignación).
 * NO borra el DocumentoGrupo ni el archivo en Aditus. Bloqueada para
 * asignaciones FIRMADO para preservar el registro legal.
 */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; asignId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, asignId } = await params
  const grupoId = Number(id)
  const asignacionId = Number(asignId)

  const asign = await prisma.documentoAsignacion.findUnique({
    where: { id: asignacionId },
    include: { employee: { select: { nombre: true, apellido: true, legajo: true } } },
  })
  if (!asign || asign.grupoId !== grupoId) {
    return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  }

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(asign.employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre ese empleado' }, { status: 403 })
  }

  if (asign.estado === 'FIRMADO') {
    return NextResponse.json({
      error: 'No se puede quitar una asignación firmada. Preserva el registro.',
    }, { status: 409 })
  }

  await prisma.documentoAsignacion.delete({ where: { id: asignacionId } })
  await logAction(user.userId, 'QUITAR_ASIGNACION_DOCUMENTO', 'Documento',
    `Grupo ${grupoId}: ${asign.employee.apellido}, ${asign.employee.nombre} (${asign.employee.legajo})`)

  return NextResponse.json({ ok: true })
}
