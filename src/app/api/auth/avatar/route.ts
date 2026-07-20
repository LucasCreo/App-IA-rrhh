import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE = 5 * 1024 * 1024

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')

  if (!file) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { avatarUrl: true, avatarBgColor: true, avatarTextColor: true },
    })
    return NextResponse.json({
      avatarUrl: dbUser?.avatarUrl ?? null,
      avatarBgColor: dbUser?.avatarBgColor ?? null,
      avatarTextColor: dbUser?.avatarTextColor ?? null,
    })
  }

  const safeName = file.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(process.cwd(), 'uploads', 'avatars', safeName)
  try {
    const data = await readFile(filePath)
    const ext = safeName.split('.').pop()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return new NextResponse(new Uint8Array(data), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE)
    return NextResponse.json({ error: 'La imagen supera el límite de 5 MB' }, { status: 400 })

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  const isWebp = buffer.length > 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  if (!isJpeg && !isPng && !isWebp)
    return NextResponse.json({ error: 'El archivo debe ser JPEG, PNG o WebP' }, { status: 400 })

  const avatarsDir = join(process.cwd(), 'uploads', 'avatars')
  await mkdir(avatarsDir, { recursive: true })

  // Borrar el avatar previo si existía
  const prev = await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarUrl: true } })
  if (prev?.avatarUrl) {
    const safe = prev.avatarUrl.replace(/[^a-zA-Z0-9._-]/g, '')
    try { await unlink(join(avatarsDir, safe)) } catch {}
  }

  const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg'
  const fileName = `${user.userId}-${Date.now()}.${ext}`
  await writeFile(join(avatarsDir, fileName), buffer)

  await prisma.user.update({ where: { id: user.userId }, data: { avatarUrl: fileName } })

  return NextResponse.json({ avatarUrl: fileName })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const prev = await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarUrl: true } })
  if (prev?.avatarUrl) {
    const safe = prev.avatarUrl.replace(/[^a-zA-Z0-9._-]/g, '')
    try { await unlink(join(process.cwd(), 'uploads', 'avatars', safe)) } catch {}
  }
  await prisma.user.update({ where: { id: user.userId }, data: { avatarUrl: null } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { avatarBgColor, avatarTextColor } = body as { avatarBgColor?: string | null; avatarTextColor?: string | null }

  const validHex = (s: unknown) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)
  const data: { avatarBgColor?: string | null; avatarTextColor?: string | null } = {}
  if (avatarBgColor === null) data.avatarBgColor = null
  else if (validHex(avatarBgColor)) data.avatarBgColor = avatarBgColor
  if (avatarTextColor === null) data.avatarTextColor = null
  else if (validHex(avatarTextColor)) data.avatarTextColor = avatarTextColor

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: user.userId }, data })
  return NextResponse.json({ ok: true })
}
