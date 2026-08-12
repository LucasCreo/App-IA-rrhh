import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const periodo = formData.get('periodo') as string | null
  const tipoDocumentoId = formData.get('tipoDocumentoId') ? Number(formData.get('tipoDocumentoId')) : null
  const categoriaId = formData.get('categoriaId') ? Number(formData.get('categoriaId')) : null
  const empleadoIdsRaw = formData.get('empleadoIds') as string | null
  const empleadoIds: number[] | null = empleadoIdsRaw ? JSON.parse(empleadoIdsRaw) : null

  if (!file) {
    return NextResponse.json({ error: 'El archivo es requerido' }, { status: 400 })
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!isPdfBuffer(buffer)) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
  }

  const where: Prisma.EmployeeWhereInput = { estado: 'ACTIVO' }
  if (empleadoIds?.length) where.id = { in: empleadoIds }
  else if (categoriaId) where.categoriaId = categoriaId

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope) where.id = { in: (empleadoIds ?? []).filter(id => scope.has(id)) }

  const empleados = await prisma.employee.findMany({ where, select: { id: true } })
  if (empleados.length === 0) {
    return NextResponse.json({ error: 'No hay empleados válidos para esta distribución' }, { status: 400 })
  }

  const uploadsDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${sanitized}`
  const filePath = path.join(uploadsDir, fileName)
  await writeFile(filePath, buffer)

  const grupo = await prisma.$transaction(async tx => {
    const g = await tx.documentoGrupo.create({
      data: {
        nombreArchivo: file.name,
        filePath,
        periodo,
        tipoDocumentoId: tipoDocumentoId ?? null,
        cargadoPorId: user.userId,
      },
    })
    await tx.documentoAsignacion.createMany({
      data: empleados.map(e => ({
        grupoId: g.id,
        employeeId: e.id,
        estado: 'BORRADOR',
      })),
    })
    return g
  })

  await logAction(user.userId, 'CARGAR_DOCUMENTO_GRUPO', 'Documento', `${file.name} → ${empleados.length} empleados${periodo ? ` · ${periodo}` : ''}`)

  return NextResponse.json({ grupoId: grupo.id, asignados: empleados.length })
}
