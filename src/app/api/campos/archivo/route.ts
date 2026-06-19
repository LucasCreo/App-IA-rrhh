import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, extname } from 'path'

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'campos')
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Falta archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })

  await mkdir(UPLOADS_DIR, { recursive: true })
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${safeName}`
  await writeFile(join(UPLOADS_DIR, fileName), buffer)

  return NextResponse.json({ fileName, nombre: file.name })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const file = new URL(req.url).searchParams.get('file')
  if (!file || file.includes('..') || /[/\\]/.test(file)) {
    return NextResponse.json({ error: 'Inválido' }, { status: 400 })
  }

  try {
    const buffer = await readFile(join(UPLOADS_DIR, file))
    const displayName = file.replace(/^\d+-/, '')
    const ext = extname(displayName).toLowerCase()
    const contentType = ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : 'application/octet-stream'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${displayName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
}
