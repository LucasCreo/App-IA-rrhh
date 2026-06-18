import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [lotes, descs] = await Promise.all([
    (prisma as any).lote.findMany({
      include: {
        tipoDocumento: { select: { id: true, nombre: true } },
        documentos: { select: { estado: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.$queryRawUnsafe<Array<{ id: number; descripcion: string | null }>>(
      `SELECT id, descripcion FROM Lote`
    ),
  ])

  const descMap = new Map(descs.map((d: any) => [d.id, d.descripcion ?? null]))

  return NextResponse.json(lotes.map((l: any) => {
    const docs: Array<{ estado: string }> = l.documentos
    return {
      id: l.id,
      nombre: l.nombre,
      descripcion: descMap.get(l.id) ?? null,
      periodo: l.periodo,
      createdAt: l.createdAt,
      tipoDocumento: l.tipoDocumento,
      stats: {
        total: docs.length,
        firmados: docs.filter(d => d.estado === 'FIRMADO').length,
        enFirma: docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
        borradores: docs.filter(d => d.estado === 'BORRADOR').length,
        errores: docs.filter(d => d.estado === 'ERROR').length,
        rechazados: docs.filter(d => d.estado === 'RECHAZADO').length,
      },
    }
  }))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const nombre = (formData.get('nombre') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim() || null
  const periodo = formData.get('periodo') as string
  const tipoDocumentoIdRaw = formData.get('tipoDocumentoId')
  const tipoDocumentoId = tipoDocumentoIdRaw ? Number(tipoDocumentoIdRaw) : undefined

  if (!nombre || !periodo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const lote = await (prisma as any).lote.create({
    data: {
      nombre,
      periodo,
      creadoPorId: user.userId,
      ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    },
  })

  if (descripcion) {
    await prisma.$executeRawUnsafe(`UPDATE Lote SET descripcion = @p1 WHERE id = @p2`, descripcion, lote.id)
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const uploaded: number[] = []
  const errors: string[] = []
  let i = 0

  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File
    const employeeId = Number(formData.get(`employeeId_${i}`))
    i++

    if (!file || !employeeId) {
      errors.push(`Archivo ${i}: datos incompletos`)
      continue
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.length > MAX_FILE_SIZE) {
      errors.push(`${file.name}: supera el límite de 10 MB`)
      continue
    }

    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      errors.push(`${file.name}: no es un PDF válido`)
      continue
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    const doc = await prisma.document.create({
      data: {
        nombreArchivo: file.name,
        filePath,
        periodo,
        employeeId,
        cargadoPorId: user.userId,
        estado: 'BORRADOR',
        loteId: lote.id,
        ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
      },
    })
    uploaded.push(doc.id)
  }

  await logAction(user.userId, 'CREAR_LOTE', 'Lote', `${nombre} — ${uploaded.length} docs`)
  return NextResponse.json({ loteId: lote.id, uploaded: uploaded.length, errors }, { status: 201 })
}
