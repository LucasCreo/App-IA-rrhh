import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const employees = await prisma.employee.findMany({
    include: { categoria: true },
    orderBy: { apellido: 'asc' },
  })

  return NextResponse.json(employees.map(e => ({
    legajo: e.legajo,
    apellido: e.apellido,
    nombre: e.nombre,
    cuil: e.cuil,
    email: e.email,
    telefono: e.telefono ?? '',
    categoria: e.categoria.nombre,
    estado: e.estado,
    fechaIngreso: e.fechaIngreso.toISOString().slice(0, 10),
  })))
}
