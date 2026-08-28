import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'

/**
 * Agrega asignaciones (empleados) a un DocumentoGrupo ya existente.
 * Crea las nuevas en estado BORRADOR; el envío a firma se hace desde
 * el detalle del grupo con el botón "Enviar".
 * Ignora silenciosamente los empleados que ya están asignados.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)
  const body = await req.json().catch(() => ({}))
  const employeeIds: number[] = Array.isArray(body?.employeeIds)
    ? body.employeeIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : []
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'Seleccioná al menos un empleado' }, { status: 400 })
  }

  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    select: { id: true, nombreArchivo: true },
  })
  if (!grupo) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Filtrar por scope
  const scope = await getScopedEmployeeIds(user.userId)
  const scopedIds = scope ? employeeIds.filter(id => scope.has(id)) : employeeIds
  if (scopedIds.length === 0) {
    return NextResponse.json({ error: 'No autorizado sobre esos empleados' }, { status: 403 })
  }

  // Solo empleados activos
  const empleadosValidos = await prisma.employee.findMany({
    where: { id: { in: scopedIds }, estado: 'ACTIVO' },
    select: { id: true },
  })
  const validIds = new Set(empleadosValidos.map(e => e.id))

  // Filtrar los que ya están asignados
  const existentes = await prisma.documentoAsignacion.findMany({
    where: { grupoId, employeeId: { in: [...validIds] } },
    select: { employeeId: true },
  })
  const yaAsignados = new Set(existentes.map(a => a.employeeId))
  const nuevos = [...validIds].filter(id => !yaAsignados.has(id))

  if (nuevos.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: employeeIds.length,
      message: 'Todos los empleados seleccionados ya estaban asignados',
    })
  }

  await prisma.documentoAsignacion.createMany({
    data: nuevos.map(employeeId => ({
      grupoId,
      employeeId,
      estado: 'BORRADOR',
    })),
  })

  await logAction(user.userId, 'AGREGAR_ASIGNACIONES_DOCUMENTO', 'Documento',
    `Grupo ${grupoId} (${grupo.nombreArchivo}): +${nuevos.length} empleados`)

  return NextResponse.json({ added: nuevos.length, skipped: employeeIds.length - nuevos.length })
}
