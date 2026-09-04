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
  // Vista propia: sin param, uso el employeeId del usuario (aplica a EMPLOYEE y a ADMIN que también es empleado)
  const vistaPropia = !employeeIdParam
  if (vistaPropia) {
    if (!user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    employeeId = user.employeeId
  } else {
    // Admin viendo el legajo de otro empleado (respetando scope)
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    employeeId = Number(employeeIdParam)
    const scope = await getScopedEmployeeIds(user.userId)
    if (scope && !scope.has(employeeId)) return NextResponse.json({ error: 'Fuera de scope' }, { status: 403 })
  }

  const asignaciones = await prisma.documentoAsignacion.findMany({
    where: {
      employeeId,
      ...(vistaPropia ? { estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO', 'RECHAZADO'] } } : {}),
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
