import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { uploadAditusFile } from '@/lib/aditus'

/**
 * Endpoint de prueba: sube un archivo a Aditus y devuelve el id que asignó.
 * multipart/form-data con:
 *   - file: el archivo
 *   - objectTitle: título (opcional, default = filename)
 *   - legajo: opcional
 *   - tipoDocumento: opcional
 */
export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file requerido' }, { status: 400 })

  const objectTitle = (fd.get('objectTitle') as string | null)?.trim() || file.name
  const legajo = (fd.get('legajo') as string | null)?.trim() || undefined
  const cuil = (fd.get('cuil') as string | null)?.trim() || undefined
  const tipoDocumento = (fd.get('tipoDocumento') as string | null)?.trim() || undefined

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const id = await uploadAditusFile({
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
