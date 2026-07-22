import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, comparePassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const docId = Number(id)

  const body = await req.json().catch(() => ({}))
  const password: string = typeof body.password === 'string' ? body.password : ''
  const conforme: boolean | null = typeof body.conforme === 'boolean' ? body.conforme : null
  const comentario: string = typeof body.comentario === 'string' ? body.comentario.trim() : ''
  if (!password) {
    return NextResponse.json({ error: 'Ingresá tu contraseña para firmar' }, { status: 400 })
  }
  if (conforme === null) {
    return NextResponse.json({ error: 'Indicá si estás conforme o no' }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { tipoDocumento: { select: { accion: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (doc.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Solo el destinatario puede firmar este documento' }, { status: 403 })
  }
  if (doc.tipoDocumento?.accion !== 'FIRMA') {
    return NextResponse.json({ error: 'Este documento no requiere firma' }, { status: 400 })
  }
  if (doc.estado !== 'ENVIADO_A_FIRMA') {
    return NextResponse.json({ error: 'El documento no está disponible para firmar' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  })
  if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const ok = await comparePassword(password, dbUser.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })

  await prisma.document.update({
    where: { id: docId },
    data: {
      estado: 'FIRMADO',
      fechaFirma: new Date(),
      firmaConforme: conforme,
      firmaComentario: comentario || null,
    },
  })

  await logAction(user.userId, 'FIRMAR_PASSWORD', 'Documento', `Doc ${docId}`)
  return NextResponse.json({ ok: true })
}
