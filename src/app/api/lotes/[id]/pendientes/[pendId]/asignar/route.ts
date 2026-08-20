import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getAditusFile, updateAditusFile } from '@/lib/aditus'
import { reciboProps } from '@/lib/aditusRecibos'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pendId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, pendId } = await params
  const loteId = Number(id)
  const pendienteId = Number(pendId)

  const body = await req.json().catch(() => ({}))
  const employeeId = Number(body?.employeeId)
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: 'employeeId requerido' }, { status: 400 })
  }

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre ese empleado' }, { status: 403 })
  }

  const [pendiente, lote, empleado] = await Promise.all([
    prisma.loteArchivoPendiente.findUnique({ where: { id: pendienteId } }),
    prisma.lote.findUnique({ where: { id: loteId }, select: { nombre: true, periodo: true, tipoDocumentoId: true } }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, estado: true, legajo: true, nombre: true, apellido: true, cuil: true } }),
  ])
  if (!pendiente || pendiente.loteId !== loteId) {
    return NextResponse.json({ error: 'Archivo pendiente no encontrado' }, { status: 404 })
  }
  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
  if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  if (!pendiente.aditusId) return NextResponse.json({ error: 'Pendiente sin archivo en Aditus' }, { status: 500 })

  // Evitar duplicados: si el empleado ya tiene un doc en este lote, rechazar
  const yaTiene = await prisma.document.findFirst({
    where: { loteId, employeeId },
    select: { id: true },
  })
  if (yaTiene) {
    return NextResponse.json({ error: 'Ese empleado ya tiene un recibo en este lote' }, { status: 409 })
  }

  // Actualizar metadata en Aditus con datos del empleado (get + put mismo id)
  try {
    const file = await getAditusFile(pendiente.aditusId, { download: true })
    await updateAditusFile(pendiente.aditusId, {
      content: file.content,
      fileName: pendiente.nombreArchivo,
      contentType: file.contentType || 'application/pdf',
      properties: reciboProps({ empleado, periodo: lote.periodo, loteNombre: lote.nombre }),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error actualizando metadata en Aditus' }, { status: 500 })
  }

  const doc = await prisma.$transaction(async tx => {
    const created = await tx.document.create({
      data: {
        nombreArchivo: pendiente.nombreArchivo,
        aditusId: pendiente.aditusId,
        periodo: lote.periodo,
        employeeId,
        cargadoPorId: user.userId,
        estado: 'BORRADOR',
        loteId,
        ...(lote.tipoDocumentoId ? { tipoDocumentoId: lote.tipoDocumentoId } : {}),
      },
    })
    await tx.loteEmpleado.upsert({
      where: { loteId_employeeId: { loteId, employeeId } },
      create: { loteId, employeeId },
      update: {},
    })
    await tx.loteArchivoPendiente.delete({ where: { id: pendienteId } })
    return created
  })

  await logAction(user.userId, 'ASIGNAR_PENDIENTE', 'Lote', `Lote ${loteId} → doc ${doc.id}`)
  return NextResponse.json({ ok: true, documentId: doc.id })
}
