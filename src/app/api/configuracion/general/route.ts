import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { invalidateConfigCache } from '@/lib/config'

export async function GET() {
  const config = await prisma.generalConfig.findFirst()
  return NextResponse.json(config ?? { appName: 'RRHH', logoUrl: null })
}

export async function PUT(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const existing = await prisma.generalConfig.findFirst()
  const data: any = {}
  if (typeof body.appName === 'string') data.appName = body.appName
  if ('logoUrl' in body) data.logoUrl = body.logoUrl || null
  if (typeof body.editWindowMin === 'number' && body.editWindowMin >= 0) data.editWindowMin = Math.floor(body.editWindowMin)
  if (typeof body.firmaMinSec === 'number' && body.firmaMinSec >= 0) data.firmaMinSec = Math.floor(body.firmaMinSec)
  if ('soporteEmail' in body) data.soporteEmail = body.soporteEmail?.trim() || null
  if ('soporteTel' in body) data.soporteTel = body.soporteTel?.trim() || null
  if (typeof body.avisosEmpleadosHabilitados === 'boolean') data.avisosEmpleadosHabilitados = body.avisosEmpleadosHabilitados
  try {
    const config = existing
      ? await prisma.generalConfig.update({ where: { id: existing.id }, data })
      : await prisma.generalConfig.create({ data })
    invalidateConfigCache()
    return NextResponse.json(config)
  } catch (e: any) {
    console.error('[configuracion/general] fallo al guardar:', e)
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
