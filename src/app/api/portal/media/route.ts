import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { detectFileKind, extForKind, type FileKind } from '@/lib/fileValidation'

const LIMITES = {
  image: 5 * 1024 * 1024,   // 5 MB
  audio: 10 * 1024 * 1024,  // 10 MB
  video: 30 * 1024 * 1024,  // 30 MB
}

function grupoDeKind(kind: FileKind): 'image' | 'audio' | 'video' | null {
  if (kind === 'jpeg' || kind === 'png' || kind === 'webp' || kind === 'gif') return 'image'
  if (kind === 'mp3' || kind === 'wav') return 'audio'
  if (kind === 'mp4' || kind === 'webm') return 'video'
  return null
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
  if (file.size > LIMITES.video) return NextResponse.json({ error: 'El archivo supera el límite máximo (30 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = detectFileKind(buffer)
  if (!kind) return NextResponse.json({ error: 'Tipo de archivo no reconocido' }, { status: 400 })
  const tipo = grupoDeKind(kind)
  if (!tipo) return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })

  if (buffer.length > LIMITES[tipo]) {
    const mb = LIMITES[tipo] / (1024 * 1024)
    return NextResponse.json({ error: `El archivo supera ${mb} MB` }, { status: 400 })
  }

  const dir = join(process.cwd(), 'public', 'uploads', 'posts', tipo)
  await mkdir(dir, { recursive: true })
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extForKind(kind)}`
  await writeFile(join(dir, fileName), buffer)

  return NextResponse.json({
    url: `/uploads/posts/${tipo}/${fileName}`,
    tipo,
  }, { status: 201 })
}
