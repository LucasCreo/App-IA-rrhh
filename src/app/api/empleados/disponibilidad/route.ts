import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim()
  const username = searchParams.get('username')?.trim()

  const conflicts: Record<string, string> = {}

  if (email) {
    const [empByEmail, userByEmail] = await Promise.all([
      prisma.employee.findFirst({ where: { email }, select: { id: true } }),
      prisma.user.findFirst({ where: { email }, select: { id: true } }),
    ])
    if (empByEmail || userByEmail) conflicts.email = 'Ya existe una cuenta con ese email'
  }

  if (username) {
    const dup = await prisma.user.findFirst({ where: { username }, select: { id: true } })
    if (dup) conflicts.username = 'Ya existe una cuenta con ese nombre de usuario'
  }

  return NextResponse.json({ conflicts })
}
