import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getTransporter, smtpDiagnostics } from '@/lib/email'

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

  const conGoogle = await prisma.user.count({
    where: { googleRefreshToken: { not: null } },
  }).catch(() => 0)
  results.google = {
    ok: conGoogle > 0,
    detail: conGoogle > 0
      ? `${conGoogle} usuario${conGoogle === 1 ? '' : 's'} con Google conectado`
      : 'Ningún usuario tiene Google vinculado',
  }

  const diag = smtpDiagnostics()
  const portStr = process.env.SMTP_PORT?.trim() || '(no set — default 587)'
  const t = getTransporter()
  if (!t) {
    const missing = Object.entries(diag)
      .filter(([k, v]) => (k === 'SMTP_HOST' || k === 'SMTP_USER' || k === 'SMTP_PASS') && v === false)
      .map(([k]) => k)
    results.smtp = { ok: false, detail: `Faltan/vacías: ${missing.join(', ') || 'ninguna (revisar código)'} | PORT=${portStr}` }
  } else {
    try {
      await t.verify()
      results.smtp = { ok: true, detail: `Conectado a ${process.env.SMTP_HOST}:${portStr} — FROM=${diag.SMTP_FROM ? 'set' : 'vacío (usará SMTP_USER)'}` }
    } catch (e: any) {
      results.smtp = { ok: false, detail: `Auth/conexión fallida a ${process.env.SMTP_HOST}:${portStr} — ${e?.message ?? 'error desconocido'}` }
    }
  }

  return NextResponse.json(results)
}
