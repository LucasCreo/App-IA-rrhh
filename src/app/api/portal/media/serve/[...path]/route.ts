import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAditusFile } from '@/lib/aditus'
import { readFile } from 'fs/promises'
import { join } from 'path'

/** Devuelve el Content-Type esperado según extensión. */
function contentTypeFromExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    // imágenes
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    // video
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo',
    // audio
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    // office
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Sirve adjuntos de posts del portal.
 * URL: /api/portal/media/serve/<tipo>/<filename>
 *
 * 1. Si el filename tiene prefijo ADITUS_<id>_ → descarga de Aditus (fuente
 *    de verdad, sobrevive a redeploys del container).
 * 2. Fallback: lee desde public/uploads/posts/<tipo>/<filename> (compatible
 *    con posts viejos y con el snapshot local que se guarda al subir).
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { path } = await params
  if (!path || path.length < 1) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })

  // Sanitizamos: no permitir traversal
  const parts = path.map(p => p.replace(/\.\.|\//g, ''))
  const filename = parts[parts.length - 1]
  const tipo = parts.length > 1 ? parts[0] : 'file'

  // 1) Aditus
  const m = filename.match(/^ADITUS_([^_]+)_/)
  if (m) {
    try {
      const file = await getAditusFile(m[1], { download: true })
      const displayName = filename.replace(/^ADITUS_[^_]+_(?:\d+-[a-z0-9]+-)?/i, '')
      // Priorizamos el content-type derivado del nombre porque Aditus a veces
      // devuelve octet-stream para video/audio/imagen y rompe la reproducción.
      const contentType = contentTypeFromExt(displayName || filename) !== 'application/octet-stream'
        ? contentTypeFromExt(displayName || filename)
        : (file.contentType || 'application/octet-stream')
      return new NextResponse(new Uint8Array(file.content), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${displayName || filename}"`,
          'Accept-Ranges': 'bytes',
        },
      })
    } catch {
      // caemos al fallback local
    }
  }

  // 2) Disco (legacy o snapshot local)
  try {
    const filePath = join(process.cwd(), 'public', 'uploads', 'posts', tipo, filename)
    const buffer = await readFile(filePath)
    const displayName = filename.replace(/^\d+-[a-z0-9]+-/i, '')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentTypeFromExt(displayName || filename),
        'Content-Disposition': `inline; filename="${displayName}"`,
        'Accept-Ranges': 'bytes',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
}
