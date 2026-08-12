import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeIdParam = searchParams.get('employeeId')

  let employeeId: number | undefined
  if (user.role === 'EMPLOYEE') {
    if (!user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    employeeId = user.employeeId
  } else {
    // Admin: puede pedir el de un empleado específico (respetando scope)
    if (!employeeIdParam) return NextResponse.json({ error: 'employeeId requerido para admin' }, { status: 400 })
    employeeId = Number(employeeIdParam)
    const scope = await getScopedEmployeeIds(user.userId)
    if (scope && !scope.has(employeeId)) return NextResponse.json({ error: 'Fuera de scope' }, { status: 403 })
  }

  const asignaciones = await prisma.documentoAsignacion.findMany({
    where: {
      employeeId,
      ...(user.role === 'EMPLOYEE' ? { estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO', 'RECHAZADO'] } } : {}),
    },
    include: {
      grupo: {
        include: {
          tipoDocumento: { select: { id: true, nombre: true, accion: true } },
        },
      },
    },
    orderBy: { fechaCarga: 'desc' },
  })

  return NextResponse.json({ asignaciones })
}
