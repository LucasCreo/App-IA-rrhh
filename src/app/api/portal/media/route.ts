import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { detectFileKind, extForKind, type FileKind } from '@/lib/fileValidation'
import { uploadAditusFile } from '@/lib/aditus'
import { avisoAdjuntoProps } from '@/lib/aditusPost'

const LIMITES = {
  image: 5 * 1024 * 1024,   // 5 MB
  audio: 10 * 1024 * 1024,  // 10 MB
  video: 30 * 1024 * 1024,  // 30 MB
  file: 30 * 1024 * 1024,   // 30 MB
}

function grupoDeKind(kind: FileKind): 'image' | 'audio' | 'video' | null {
  if (kind === 'jpeg' || kind === 'png' || kind === 'webp' || kind === 'gif') return 'image'
  if (kind === 'mp3' || kind === 'wav') return 'audio'
  if (kind === 'mp4' || kind === 'webm') return 'video'
  return null
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'archivo'
}

function contentTypeFromName(name: string, fallback: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
  }
  return map[ext] ?? fallback ?? 'application/octet-stream'
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const intent = fd.get('kind') as string | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 })
  if (file.size > LIMITES.file) return NextResponse.json({ error: 'El archivo supera el límite máximo (30 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let tipo: 'image' | 'audio' | 'video' | 'file'
  let extension: string
  if (intent === 'file') {
    tipo = 'file'
    extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  } else {
    const kind = detectFileKind(buffer)
    if (!kind) return NextResponse.json({ error: 'Tipo de archivo no reconocido' }, { status: 400 })
    let t = grupoDeKind(kind)
    if (!t) return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
    // webm es un contenedor ambiguo (audio o video). Si el cliente lo etiquetó como audio, respetarlo.
    if (kind === 'webm' && intent === 'audio') t = 'audio'
    if (buffer.length > LIMITES[t]) {
      const mb = LIMITES[t] / (1024 * 1024)
      return NextResponse.json({ error: `El archivo supera ${mb} MB` }, { status: 400 })
    }
    tipo = t
    extension = extForKind(kind)
  }

  const originalName = safeName(file.name || `archivo.${extension}`)
  const baseName = tipo === 'file'
    ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${originalName}`
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  // Subida a Aditus (síncrona: si tiene éxito, embebemos el aditusId en el nombre
  // local para poder eliminarlo/actualizarlo después. Si falla, seguimos igual
  // pero sin espejo — el usuario no debería quedar bloqueado por Aditus).
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      email: true,
      employee: { select: { nombre: true, apellido: true, legajo: true, cuil: true } },
    },
  }).catch(() => null)

  let aditusId: string | null = null
  try {
    aditusId = await uploadAditusFile({
      content: buffer,
      fileName: originalName,
      contentType: contentTypeFromName(originalName, file.type),
      properties: avisoAdjuntoProps({
        fileName: originalName,
        autorEmail: dbUser?.email ?? user.userId.toString(),
        autor: dbUser?.employee ?? null,
      }),
    })
  } catch (e) {
    console.error('[portal/media] aditus upload fail:', e)
  }

  const finalName = aditusId ? `ADITUS_${aditusId}_${baseName}` : baseName
  const dir = join(process.cwd(), 'public', 'uploads', 'posts', tipo)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, finalName), buffer)

  const url = `/uploads/posts/${tipo}/${finalName}`
  return NextResponse.json({ url, tipo, fileName: originalName }, { status: 201 })
}
