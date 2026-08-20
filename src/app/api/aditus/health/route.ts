import { NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getAditusToken, getAditusTokenInfo, invalidateAditusToken } from '@/lib/aditus'

/**
 * Endpoint de diagnóstico: fuerza refresh del token y devuelve info de expiración.
 * Solo admin con permiso de configuración.
 * Uso: GET /api/aditus/health?force=true para invalidar cache y pedir uno nuevo.
 */
export async function GET(req: Request) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const force = new URL(req.url).searchParams.get('force') === 'true'
  if (force) invalidateAditusToken()

  try {
    const t0 = Date.now()
    await getAditusToken()
    const ms = Date.now() - t0
    return NextResponse.json({ ok: true, elapsedMs: ms, ...getAditusTokenInfo() })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }, { status: 500 })
  }
}
