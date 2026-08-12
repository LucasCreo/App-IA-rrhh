import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'
import { readFile } from 'fs/promises'

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

  try {
    const buffer = await readFile(grupo.filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${grupo.nombreArchivo}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }
}
