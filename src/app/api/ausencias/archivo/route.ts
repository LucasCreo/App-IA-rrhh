import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAditusFile } from '@/lib/aditus'
import { parseArchivoRef, displayNameFromRef } from '@/lib/aditusSolicitudes'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ref = new URL(req.url).searchParams.get('file')
  if (!ref) return NextResponse.json({ error: 'Inválido' }, { status: 400 })

  const { aditusId, nombre } = parseArchivoRef(ref)
  if (!aditusId) return NextResponse.json({ error: 'Ref inválida' }, { status: 400 })

  try {
    const f = await getAditusFile(aditusId, { download: true })
    return new NextResponse(new Uint8Array(f.content), {
      headers: {
        'Content-Type': f.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${displayNameFromRef(nombre) || 'archivo'}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }
}
