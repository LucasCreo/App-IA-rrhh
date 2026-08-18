import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)

  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    include: { asignaciones: { select: { estado: true } } },
  })
  if (!grupo) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const firmados = grupo.asignaciones.filter(a => a.estado === 'FIRMADO').length
  if (firmados > 0) {
    return NextResponse.json({
      error: `No se puede reemplazar: hay ${firmados} asignación${firmados !== 1 ? 'es' : ''} ya firmada${firmados !== 1 ? 's' : ''}.`,
    }, { status: 409 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_PDF_SIZE) {
    return NextResponse.json({ error: `${file.name}: supera el límite de 10 MB` }, { status: 400 })
  }
  if (!isPdfBuffer(buffer)) {
    return NextResponse.json({ error: `${file.name}: no es un PDF válido` }, { status: 400 })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = join(uploadsDir, fileName)
  await writeFile(filePath, buffer)

  const oldPath = grupo.filePath
  await prisma.$transaction([
    prisma.documentoGrupo.update({
      where: { id: grupoId },
      data: { nombreArchivo: file.name, filePath },
    }),
    // Resetear asignaciones enviadas de vuelta a borrador (excepto rechazadas que quedan como están)
    prisma.documentoAsignacion.updateMany({
      where: { grupoId, estado: 'ENVIADO_A_FIRMA' },
      data: { estado: 'BORRADOR' },
    }),
  ])

  try { await unlink(oldPath) } catch { /* no-op */ }

  await logAction(user.userId, 'REEMPLAZAR_DOCUMENTO_GRUPO', 'Documento', `Grupo ${grupoId}: ${file.name}`)
  return NextResponse.json({ ok: true })
}
