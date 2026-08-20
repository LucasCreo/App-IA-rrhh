import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { deleteAditusFile } from '@/lib/aditus'

/**
 * Endpoint de prueba: elimina un archivo de Aditus por id.
 * multipart/form-data o JSON con:
 *   - id: el id devuelto por la subida original
 */
export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  let id: string | undefined
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    id = typeof body?.id === 'string' ? body.id.trim() : undefined
  } else {
    const fd = await req.formData()
    id = (fd.get('id') as string | null)?.trim() || undefined
  }

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  try {
    await deleteAditusFile(id)
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }, { status: 500 })
  }
}
