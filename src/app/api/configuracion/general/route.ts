import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const config = await prisma.generalConfig.findFirst()
  return NextResponse.json(config ?? { appName: 'RRHH', logoUrl: null, primaryColor: '#166534' })
}

export async function PUT(req: NextRequest) {
  const { appName, logoUrl, primaryColor } = await req.json()
  const existing = await prisma.generalConfig.findFirst()
  const data = { appName, logoUrl: logoUrl || null, primaryColor }
  const config = existing
    ? await prisma.generalConfig.update({ where: { id: existing.id }, data })
    : await prisma.generalConfig.create({ data })
  return NextResponse.json(config)
}
