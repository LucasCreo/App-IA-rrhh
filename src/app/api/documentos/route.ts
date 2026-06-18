import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const estado = searchParams.get('estado')
  const periodo = searchParams.get('periodo') ?? undefined

  const VALID_ESTADOS = ['BORRADOR', 'ENVIADO_A_FIRMA', 'FIRMADO', 'RECHAZADO', 'ERROR']
  if (estado && !VALID_ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Empleados solo pueden ver sus propios documentos y nunca los borradores
  const effectiveEmployeeId = user.role === 'EMPLOYEE'
    ? user.employeeId
    : (employeeId ? Number(employeeId) : undefined)

  const docs = await prisma.document.findMany({
    where: {
      ...(effectiveEmployeeId ? { employeeId: effectiveEmployeeId } : {}),
      ...(estado ? { estado } : {}),
      ...(user.role === 'EMPLOYEE' ? { estado: { not: 'BORRADOR' } } : {}),
      ...(periodo ? { periodo: { contains: periodo } } : {}),
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
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const employeeId = Number(formData.get('employeeId'))
  const periodo = formData.get('periodo') as string
  const tipoDocumentoIdRaw = formData.get('tipoDocumentoId')
  const tipoDocumentoId = tipoDocumentoIdRaw ? Number(tipoDocumentoIdRaw) : undefined

  if (!file || !employeeId || !periodo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  }

  // Validar magic bytes de PDF (%PDF = 0x25 0x50 0x44 0x46)
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return NextResponse.json({ error: 'El archivo no es un PDF válido' }, { status: 400 })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

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
      ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
    },
  })

  await logAction(user.userId, 'CARGAR', 'Documento', `${file.name} → ${doc.employee.legajo}`)
  return NextResponse.json(doc, { status: 201 })
}
