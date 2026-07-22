import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const docId = Number(id)

  const existing = await prisma.document.findUnique({ where: { id: docId } })
  if (!existing) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (existing.estado === 'FIRMADO') {
    return NextResponse.json({ error: 'No se puede reemplazar un documento firmado. Emití un rectificativo.' }, { status: 409 })
  }

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(existing.employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre este documento' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `${file.name}: supera el límite de 10 MB` }, { status: 400 })
  }
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return NextResponse.json({ error: `${file.name}: no es un PDF válido` }, { status: 400 })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = join(uploadsDir, fileName)
  await writeFile(filePath, buffer)

  const oldPath = existing.filePath
  await prisma.document.update({
    where: { id: docId },
    data: {
      nombreArchivo: file.name,
      filePath,
      estado: 'BORRADOR',
      firmaExternalId: null,
      fechaFirma: null,
    },
  })

  // Borrar el archivo viejo del disco (best-effort)
  try { await unlink(oldPath) } catch { /* no-op */ }

  await logAction(user.userId, 'REEMPLAZAR', 'Documento', `ID ${docId}: ${file.name}`)
  return NextResponse.json({ ok: true })
}
