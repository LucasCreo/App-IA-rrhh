import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { uploadAditusFile, deleteAditusFile, getAditusFile } from '@/lib/aditus'
import { avatarProps } from '@/lib/aditusAvatar'

const MAX_SIZE = 5 * 1024 * 1024
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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

  // Aditus: el file es un UUID que coincide con avatarAditusId de algún user.
  if (UUID_RE.test(file)) {
    const owner = await prisma.user.findFirst({ where: { avatarAditusId: file }, select: { id: true } })
    if (!owner) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    try {
      // download devuelve el binario original con su content-type real;
      // el endpoint de preview a veces devuelve un render HTML para imágenes.
      const f = await getAditusFile(file, { download: true })
      // Si Aditus devuelve octet-stream u otro no-imagen, detectamos por magic bytes.
      let mime = f.contentType
      if (!mime || !mime.startsWith('image/')) {
        const b = f.content
        if (b[0] === 0xff && b[1] === 0xd8) mime = 'image/jpeg'
        else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) mime = 'image/png'
        else if (b.length > 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) mime = 'image/webp'
        else mime = 'image/jpeg'
      }
      return new NextResponse(new Uint8Array(f.content), {
        headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' },
      })
    } catch {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
  }

  // Backward-compat: archivo local en /uploads/avatars/.
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

function resolveTargetId(url: string, currentUserId: number, currentRole: string): { targetId: number | null; err?: string } {
  const requested = new URL(url).searchParams.get('userId')
  if (!requested) return { targetId: currentUserId }
  const id = Number(requested)
  if (!Number.isFinite(id)) return { targetId: null, err: 'userId inválido' }
  if (id !== currentUserId && currentRole !== 'ADMIN') return { targetId: null, err: 'Prohibido' }
  return { targetId: id }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { targetId, err } = resolveTargetId(req.url, user.userId, user.role)
  if (err || !targetId) return NextResponse.json({ error: err ?? 'userId inválido' }, { status: err === 'Prohibido' ? 403 : 400 })

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

  const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg'
  const contentType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      avatarAditusId: true,
      employee: { select: { nombre: true, apellido: true, legajo: true, cuil: true } },
    },
  })
  if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (!targetUser.employee) return NextResponse.json({ error: 'El usuario no tiene empleado asociado' }, { status: 400 })

  const aditusId = await uploadAditusFile({
    content: buffer,
    fileName: `avatar-${targetId}-${Date.now()}.${ext}`,
    contentType,
    properties: avatarProps(targetUser.employee),
  })

  // Borrar el anterior de Aditus (best-effort)
  if (targetUser.avatarAditusId) {
    deleteAditusFile(targetUser.avatarAditusId).catch(e => console.error('[avatar] delete prev aditus fail:', e))
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { avatarAditusId: aditusId, avatarUrl: aditusId },
  })

  return NextResponse.json({ avatarUrl: aditusId })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { targetId, err } = resolveTargetId(req.url, user.userId, user.role)
  if (err || !targetId) return NextResponse.json({ error: err ?? 'userId inválido' }, { status: err === 'Prohibido' ? 403 : 400 })

  const prev = await prisma.user.findUnique({ where: { id: targetId }, select: { avatarAditusId: true } })
  if (prev?.avatarAditusId) {
    deleteAditusFile(prev.avatarAditusId).catch(e => console.error('[avatar] delete aditus fail:', e))
  }
  await prisma.user.update({ where: { id: targetId }, data: { avatarUrl: null, avatarAditusId: null } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { targetId, err } = resolveTargetId(req.url, user.userId, user.role)
  if (err || !targetId) return NextResponse.json({ error: err ?? 'userId inválido' }, { status: err === 'Prohibido' ? 403 : 400 })

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
  await prisma.user.update({ where: { id: targetId }, data })
  return NextResponse.json({ ok: true })
}
