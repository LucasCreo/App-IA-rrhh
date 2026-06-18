import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ count: 0 })

  const count = await prisma.solicitudModificacion.count({ where: { estado: 'PENDIENTE' } })
  return NextResponse.json({ count })
}
