import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

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
  const estadoRaw = formData.get('estado') as string | null
  const estadoDoc = estadoRaw === 'BORRADOR' ? 'BORRADOR' : 'ENVIADO_A_FIRMA'

  if (!file) {
    return NextResponse.json({ error: 'El archivo es requerido' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${sanitized}`
  const filePath = path.join(process.cwd(), 'uploads', fileName)
  await writeFile(filePath, buffer)

  const where: any = { estado: 'ACTIVO' }
  if (empleadoIds?.length) where.id = { in: empleadoIds }
  else if (categoriaId) where.categoriaId = categoriaId

  const empleados = await prisma.employee.findMany({ where, select: { id: true } })
  if (empleados.length === 0) {
    return NextResponse.json({ error: 'No hay empleados activos en esa categoría' }, { status: 400 })
  }

  await prisma.document.createMany({
    data: empleados.map(e => ({
      nombreArchivo: file.name,
      filePath,
      periodo,
      employeeId: e.id,
      cargadoPorId: user.userId,
      estado: estadoDoc,
      tipoDocumentoId,
    })),
  })

  await logAction(user.userId, 'DISTRIBUCION_MASIVA', 'Documento', `${empleados.length} empleados${periodo ? ` · ${periodo}` : ''}`)

  return NextResponse.json({ uploaded: empleados.length })
}
