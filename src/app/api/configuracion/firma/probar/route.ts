import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendToProvider } from '@/lib/firmaProvider'

/**
 * Prueba una config de proveedor con datos ficticios y devuelve la respuesta cruda.
 * No guarda nada. Usa el `firmaApiSecret` que venga en el body (si querés probar
 * el secret guardado hay que copiarlo — el server no lo devuelve por seguridad).
 */
export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const {
    firmaEndpoint, firmaBody, firmaHeaders,
    firmaApiKey, firmaApiSecret,
  } = body as Record<string, unknown>

  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim()) ? v : null
  const cfg = {
    firmaEndpoint: str(firmaEndpoint),
    firmaBody:     str(firmaBody),
    firmaHeaders:  str(firmaHeaders),
    firmaApiKey:   str(firmaApiKey),
    firmaApiSecret:str(firmaApiSecret),
  }
  if (!cfg.firmaEndpoint) return NextResponse.json({ error: 'Falta la URL (endpoint)' }, { status: 400 })

  try {
    const r = await sendToProvider({
      tipo: cfg,
      ctx: {
        documentId: 0,
        documentUrl: 'https://example.com/test.pdf',
        empleado: {
          legajo: '9999', cuil: '20-99999999-9',
          nombre: 'Test', apellido: 'Empleado',
          email: 'test@ejemplo.com',
        },
        lote: { nombre: 'Lote de prueba', periodo: '2026-01' },
        aditusId: null,  // sin file real; si el body usa {fileBase64} falla y ese error se ve
      },
    })
    return NextResponse.json(r)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, status: 0, url: '', body: msg }, { status: 200 })
  }
}
