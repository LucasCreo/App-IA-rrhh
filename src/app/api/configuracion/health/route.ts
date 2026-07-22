import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { SIGNATURE_MODE } from '@/lib/features'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const results: Record<string, { ok: boolean; detail: string }> = {}

  const t0 = Date.now()
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    results.db = { ok: true, detail: `Conectado (${Date.now() - t0}ms)` }
  } catch (e: any) {
    results.db = { ok: false, detail: e?.message ?? 'Sin conexión a la DB' }
  }

  results.firma = {
    ok: true,
    detail: SIGNATURE_MODE === 'password'
      ? 'Modo contraseña (interno)'
      : 'Modo proveedor externo',
  }

  const conGoogle = await prisma.user.count({
    where: { googleRefreshToken: { not: null } },
  }).catch(() => 0)
  results.google = {
    ok: conGoogle > 0,
    detail: conGoogle > 0
      ? `${conGoogle} usuario${conGoogle === 1 ? '' : 's'} con Google conectado`
      : 'Ningún usuario tiene Google vinculado',
  }

  const smtpConfigured = !!process.env.SMTP_HOST && !!process.env.SMTP_USER
  results.smtp = {
    ok: smtpConfigured,
    detail: smtpConfigured
      ? `Configurado (${process.env.SMTP_HOST})`
      : 'Sin configuración SMTP en variables de entorno',
  }

  return NextResponse.json(results)
}
