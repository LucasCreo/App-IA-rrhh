import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = Number(searchParams.get('employeeId'))
  const anio = Number(searchParams.get('anio') ?? new Date().getFullYear())
  if (!employeeId) return NextResponse.json({ error: 'employeeId requerido' }, { status: 400 })

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(employeeId)) return NextResponse.json({ error: 'Fuera de tu jerarquía' }, { status: 403 })

  const saldo = await prisma.saldoVacaciones.findUnique({
    where: { employeeId_anio: { employeeId, anio } },
  })
  return NextResponse.json(saldo ?? { diasTotales: 0, diasUsados: 0 })
}
