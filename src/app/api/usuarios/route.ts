import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      employee: {
        select: {
          id: true, nombre: true, apellido: true, legajo: true,
          categoria: { select: { nombre: true } },
        },
      },
      permisos: { select: { permiso: true } },
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })

  return NextResponse.json(usuarios.map(u => ({
    ...u,
    permisos: u.permisos.map(p => p.permiso),
  })))
}
