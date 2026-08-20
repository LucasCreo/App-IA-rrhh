import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import { uploadAditusFile, deleteAditusFile } from '@/lib/aditus'
import { documentoGrupoProps } from '@/lib/aditusDocumentos'

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
  if (!tipoDocumentoId) {
    return NextResponse.json({ error: 'El tipo de documento es requerido' }, { status: 400 })
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

  const empleados = await prisma.employee.findMany({ where, select: { id: true, legajo: true } })
  if (empleados.length === 0) {
    return NextResponse.json({ error: 'No hay empleados válidos para esta distribución' }, { status: 400 })
  }

  const tipoDoc = await prisma.tipoDocumento.findUnique({
    where: { id: tipoDocumentoId },
    select: { nombre: true },
  })

  let aditusId: string
  try {
    aditusId = await uploadAditusFile({
      content: buffer,
      fileName: file.name,
      contentType: 'application/pdf',
      properties: documentoGrupoProps({
        nombreArchivo: file.name,
        tipoDocumentoNombre: tipoDoc?.nombre ?? null,
        empleados,
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
  }

  let grupo
  try {
    grupo = await prisma.$transaction(async tx => {
      const g = await tx.documentoGrupo.create({
        data: {
          nombreArchivo: file.name,
          aditusId,
          periodo,
          tipoDocumentoId,
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
  } catch (e) {
    try { await deleteAditusFile(aditusId) } catch { /* rollback best-effort */ }
    return NextResponse.json({ error: e instanceof Prisma.PrismaClientKnownRequestError ? e.message : (e instanceof Error ? e.message : 'Error creando grupo') }, { status: 500 })
  }

  await logAction(user.userId, 'CARGAR_DOCUMENTO_GRUPO', 'Documento', `${file.name} → ${empleados.length} empleados${periodo ? ` · ${periodo}` : ''}`)

  return NextResponse.json({ grupoId: grupo.id, asignados: empleados.length })
}
