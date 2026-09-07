import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

/**
 * GET: devuelve la config del proveedor externo de firma electrónica.
 * El secret nunca se expone; se devuelve `firmaApiSecretSet: boolean`
 * indicando si hay uno guardado (mismo patrón que /api/configuracion/sftp).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const c = await prisma.generalConfig.findFirst({
    select: {
      firmaEnabled: true,
      firmaProveedor: true,
      firmaApiUrl: true,
      firmaApiKey: true,
      firmaApiSecret: true,
      firmaApiHeaders: true,
      firmaApiBody: true,
    },
  })
  return NextResponse.json({
    firmaEnabled: c?.firmaEnabled ?? false,
    firmaProveedor: c?.firmaProveedor ?? '',
    firmaApiUrl: c?.firmaApiUrl ?? '',
    firmaApiKey: c?.firmaApiKey ?? '',
    firmaApiSecretSet: !!c?.firmaApiSecret,
    firmaApiHeaders: c?.firmaApiHeaders ?? '',
    firmaApiBody: c?.firmaApiBody ?? '',
  })
}

/**
 * PUT: actualiza la config. Si `firmaApiSecret` viene vacío o ausente,
 * NO se toca el existente (para permitir "editar sin re-tipear el secret").
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const {
    firmaEnabled, firmaProveedor, firmaApiUrl, firmaApiKey, firmaApiSecret,
    firmaApiHeaders, firmaApiBody,
  } = body as Record<string, unknown>

  // Validación de JSON: si viene una string no vacía, tiene que parsear
  function normalizarJson(v: unknown, campo: string): string | null | { error: string } {
    if (typeof v !== 'string') return null
    const t = v.trim()
    if (!t) return null
    try { JSON.parse(t); return t }
    catch { return { error: `${campo} no es JSON válido` } }
  }
  const headersVal = normalizarJson(firmaApiHeaders, 'Headers')
  if (headersVal && typeof headersVal === 'object' && 'error' in headersVal) {
    return NextResponse.json({ error: headersVal.error }, { status: 400 })
  }
  const bodyVal = normalizarJson(firmaApiBody, 'Body')
  if (bodyVal && typeof bodyVal === 'object' && 'error' in bodyVal) {
    return NextResponse.json({ error: bodyVal.error }, { status: 400 })
  }

  const data: Record<string, unknown> = {
    firmaEnabled: !!firmaEnabled,
    firmaProveedor: typeof firmaProveedor === 'string' ? firmaProveedor.trim() || null : null,
    firmaApiUrl:    typeof firmaApiUrl    === 'string' ? firmaApiUrl.trim()    || null : null,
    firmaApiKey:    typeof firmaApiKey    === 'string' ? firmaApiKey.trim()    || null : null,
    firmaApiHeaders: headersVal as string | null,
    firmaApiBody:    bodyVal as string | null,
  }
  if (typeof firmaApiSecret === 'string' && firmaApiSecret.length > 0) {
    data.firmaApiSecret = firmaApiSecret
  }

  const existing = await prisma.generalConfig.findFirst({ select: { id: true } })
  if (existing) {
    await prisma.generalConfig.update({ where: { id: existing.id }, data })
  } else {
    await prisma.generalConfig.create({ data: data as any })
  }
  await logAction(user.userId, 'ACTUALIZAR_CONFIG_FIRMA', 'GeneralConfig', `enabled=${!!firmaEnabled}${data.firmaProveedor ? ` · ${data.firmaProveedor}` : ''}`)
  return NextResponse.json({ ok: true })
}
