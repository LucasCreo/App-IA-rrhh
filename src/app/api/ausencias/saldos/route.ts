import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const anio = new Date().getFullYear()
  const [employees, saldos] = await Promise.all([
    prisma.employee.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true, nombre: true, apellido: true, legajo: true },
      orderBy: { apellido: 'asc' },
    }),
    prisma.saldoVacaciones.findMany({ where: { anio } }),
  ])

  const result = employees.map(e => {
    const saldo = saldos.find(s => s.employeeId === e.id)
    return {
      ...e,
      anio,
      diasTotales: saldo?.diasTotales ?? 14,
      diasUsados: saldo?.diasUsados ?? 0,
      saldoId: saldo?.id ?? null,
    }
  })
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { employeeId, anio, diasTotales } = await req.json()
  const saldo = await prisma.saldoVacaciones.upsert({
    where: { employeeId_anio: { employeeId: Number(employeeId), anio: Number(anio) } },
    update: { diasTotales: Number(diasTotales) },
    create: { employeeId: Number(employeeId), anio: Number(anio), diasTotales: Number(diasTotales) },
  })
  return NextResponse.json(saldo)
}
