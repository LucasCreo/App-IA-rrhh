import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { updateAditusFile } from '@/lib/aditus'

/**
 * Endpoint de prueba: reemplaza el contenido + metadata de un archivo ya subido a Aditus.
 * multipart/form-data con:
 *   - id: el id devuelto por la subida original
 *   - file: el nuevo archivo
 *   - objectTitle, legajo, cuil, tipoDocumento: opcionales
 */
export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fd = await req.formData()
  const id = (fd.get('id') as string | null)?.trim()
  const file = fd.get('file') as File | null
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'file requerido' }, { status: 400 })

  const objectTitle = (fd.get('objectTitle') as string | null)?.trim() || file.name
  const legajo = (fd.get('legajo') as string | null)?.trim() || undefined
  const cuil = (fd.get('cuil') as string | null)?.trim() || undefined
  const tipoDocumento = (fd.get('tipoDocumento') as string | null)?.trim() || undefined

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await updateAditusFile(id, {
      content: buffer,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      properties: { objectTitle, legajo, cuil, tipoDocumento },
    })
    return NextResponse.json({ ok: true, id, sizeBytes: buffer.length })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }, { status: 500 })
  }
}
