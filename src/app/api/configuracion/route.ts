import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const config = await prisma.signatureConfig.findFirst()
  return NextResponse.json(config ?? { providerUrl: '', apiKey: '', extraHeaders: '{}', extraBody: '{}' })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { providerUrl, apiKey, extraHeaders, extraBody } = await req.json()
  const existing = await prisma.signatureConfig.findFirst()

  const data = { providerUrl, apiKey, extraHeaders: extraHeaders || '{}', extraBody: extraBody || '{}' }

  const config = existing
    ? await prisma.signatureConfig.update({ where: { id: existing.id }, data })
    : await prisma.signatureConfig.create({ data })

  return NextResponse.json(config)
}
