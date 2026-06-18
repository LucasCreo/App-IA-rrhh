import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const config = await prisma.generalConfig.findFirst()
  return NextResponse.json(config ?? { appName: 'RRHH', logoUrl: null })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { appName, logoUrl } = await req.json()
  const existing = await prisma.generalConfig.findFirst()
  const data = { appName, logoUrl: logoUrl || null }
  const config = existing
    ? await prisma.generalConfig.update({ where: { id: existing.id }, data })
    : await prisma.generalConfig.create({ data })
  return NextResponse.json(config)
}
