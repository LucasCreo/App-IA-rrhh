import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const tipos = await prisma.tipoSolicitud.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(tipos.map(t => ({
      ...t,
      campos: JSON.parse(t.campos ?? '[]'),
    })))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
