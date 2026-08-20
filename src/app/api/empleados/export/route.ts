import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? undefined
  const categoriaId = searchParams.get('categoriaId') ? Number(searchParams.get('categoriaId')) : undefined
  const areaId = searchParams.get('areaId') ? Number(searchParams.get('areaId')) : undefined

  const scope = await getScopedEmployeeIds(user.userId)
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      q ? {
        OR: [
          { nombre: { contains: q } },
          { apellido: { contains: q } },
          { legajo: { contains: q } },
          { cuil: { contains: q } },
          { email: { contains: q } },
        ],
      } : {},
      estado ? { estado } : {},
      categoriaId ? { categoriaId } : {},
      areaId ? { areaId } : {},
      scope ? { id: { in: [...scope] } } : {},
    ],
  }

  const [employees, campos] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        area: true,
        categoria: true,
        valoresCampos: { include: { campo: true } },
      },
      orderBy: { apellido: 'asc' },
    }),
    prisma.campoPersonalizado.findMany({
      where: { visible: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    }),
  ])

  return NextResponse.json({
    campos: campos.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })),
    rows: employees.map(e => {
      const valores: Record<string, string> = {}
      for (const v of e.valoresCampos) {
        if (!v.campo.visible) continue
        valores[v.campo.nombre] = v.valor
      }
      return {
        legajo: e.legajo,
        apellido: e.apellido,
        nombre: e.nombre,
        cuil: e.cuil,
        email: e.email,
        telefono: e.telefono ?? '',
        area: e.area?.nombre ?? '',
        categoria: e.categoria.nombre,
        puesto: e.puesto ?? '',
        estado: e.estado,
        fechaIngreso: e.fechaIngreso.toISOString().slice(0, 10),
        valores,
      }
    }),
  })
}
