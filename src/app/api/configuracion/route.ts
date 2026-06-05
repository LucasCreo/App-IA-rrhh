import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const config = await prisma.signatureConfig.findFirst()
  return NextResponse.json(config ?? { providerUrl: '', apiKey: '', extraHeaders: '{}', extraBody: '{}' })
}

export async function PUT(req: NextRequest) {
  const { providerUrl, apiKey, extraHeaders, extraBody } = await req.json()
  const existing = await prisma.signatureConfig.findFirst()

  const data = { providerUrl, apiKey, extraHeaders: extraHeaders || '{}', extraBody: extraBody || '{}' }

  const config = existing
    ? await prisma.signatureConfig.update({ where: { id: existing.id }, data })
    : await prisma.signatureConfig.create({ data })

  return NextResponse.json(config)
}
