import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getAditusFile } from '@/lib/aditus'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const grupoId = Number(id)
  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    include: { asignaciones: { select: { employeeId: true } } },
  })
  if (!grupo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Empleado: sólo puede leerlo si tiene una asignación
  if (user.role === 'EMPLOYEE') {
    if (!user.employeeId || !grupo.asignaciones.some(a => a.employeeId === user.employeeId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  } else {
    // Admin: verificar scope
    const scope = await getScopedEmployeeIds(user.userId)
    if (scope && !grupo.asignaciones.some(a => scope.has(a.employeeId))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  if (!grupo.aditusId) {
    return NextResponse.json({ error: 'Documento sin archivo en Aditus' }, { status: 404 })
  }

  try {
    const file = await getAditusFile(grupo.aditusId, { download: true })
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        'Content-Type': file.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${grupo.nombreArchivo}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible en Aditus' }, { status: 404 })
  }
}
