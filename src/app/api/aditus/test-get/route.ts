import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getAditusFile } from '@/lib/aditus'

function sniffContentType(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

/**
 * Endpoint de prueba: descarga un archivo de Aditus por id y lo devuelve como binario.
 * GET /api/aditus/test-get?id=UUID
 */
export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')?.trim()
  const download = req.nextUrl.searchParams.get('download') === 'true'
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  try {
    const file = await getAditusFile(id, { download })
    let contentType = file.contentType
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = sniffContentType(file.content) || contentType || 'application/octet-stream'
    }
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Length', String(file.content.length))
    const dispositionType = download ? 'attachment' : 'inline'
    if (file.fileName) {
      headers.set('Content-Disposition', `${dispositionType}; filename="${file.fileName}"`)
    } else if (download) {
      headers.set('Content-Disposition', 'attachment')
    }
    return new NextResponse(new Uint8Array(file.content), { status: 200, headers })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }, { status: 500 })
  }
}
