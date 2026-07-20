import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const LIMITES = {
  image: 5 * 1024 * 1024,   // 5 MB
  audio: 10 * 1024 * 1024,  // 10 MB
  video: 30 * 1024 * 1024,  // 30 MB
}

function tipoDeArchivo(mime: string): 'image' | 'audio' | 'video' | null {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  return null
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })

  const tipo = tipoDeArchivo(file.type)
  if (!tipo) return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })

  if (file.size > LIMITES[tipo]) {
    const mb = LIMITES[tipo] / (1024 * 1024)
    return NextResponse.json({ error: `El archivo supera ${mb} MB` }, { status: 400 })
  }

  const dir = join(process.cwd(), 'public', 'uploads', 'posts', tipo)
  await mkdir(dir, { recursive: true })
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await writeFile(join(dir, fileName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    url: `/uploads/posts/${tipo}/${fileName}`,
    tipo,
  }, { status: 201 })
}
