import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const estado = searchParams.get('estado')

  const docs = await prisma.document.findMany({
    where: {
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
      cargadoPor: { select: { email: true } },
      tipoDocumento: { select: { id: true, nombre: true } },
    },
    orderBy: { fechaCarga: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const employeeId = Number(formData.get('employeeId'))
  const periodo = formData.get('periodo') as string
  const tipoDocumentoIdRaw = formData.get('tipoDocumentoId')
  const tipoDocumentoId = tipoDocumentoIdRaw ? Number(tipoDocumentoIdRaw) : undefined

  if (!file || !employeeId || !periodo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = join(uploadsDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const doc = await prisma.document.create({
    data: {
      nombreArchivo: file.name,
      filePath,
      periodo,
      employeeId,
      cargadoPorId: user.userId,
      estado: 'BORRADOR',
      ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
    },
  })

  await logAction(user.userId, 'CARGAR', 'Documento', `${file.name} → ${doc.employee.legajo}`)
  return NextResponse.json(doc, { status: 201 })
}
