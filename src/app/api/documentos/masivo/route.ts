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
import { sendMailFromTemplate } from '@/lib/emailTemplates'
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
  const estadoRaw = formData.get('estado') as string | null
  const estadoDoc = estadoRaw === 'BORRADOR' ? 'BORRADOR' : 'ENVIADO_A_FIRMA'

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

  // Un archivo por empleado en disco para evitar que un DELETE borre el PDF compartido
  const uploadsDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  const created: number[] = []
  for (const emp of empleados) {
    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${sanitized}`
    const filePath = path.join(uploadsDir, fileName)
    await writeFile(filePath, buffer)
    const doc = await prisma.document.create({
      data: {
        nombreArchivo: file.name,
        filePath,
        periodo,
        employeeId: emp.id,
        cargadoPorId: user.userId,
        estado: estadoDoc,
        tipoDocumentoId,
      },
    })
    created.push(doc.id)
  }

  await logAction(user.userId, 'DISTRIBUCION_MASIVA', 'Documento', `${created.length} empleados${periodo ? ` · ${periodo}` : ''}`)

  // Si se cargan como ENVIADO_A_FIRMA, notificar por email a los destinatarios
  if (estadoDoc === 'ENVIADO_A_FIRMA') {
    ;(async () => {
      try {
        const docs = await prisma.document.findMany({
          where: { id: { in: created } },
          include: {
            employee: { select: { nombre: true, email: true } },
            tipoDocumento: { select: { nombre: true, accion: true } },
          },
        })
        await Promise.all(docs
          .filter(d => d.employee?.email)
          .map(d => {
            const accion = d.tipoDocumento?.accion ?? 'FIRMA'
            const requiereFirma = accion === 'FIRMA'
            const tipo = d.tipoDocumento?.nombre ?? 'Documento'
            return sendMailFromTemplate('DOCUMENTO_A_FIRMA', {
              to: d.employee.email,
              vars: {
                nombre: d.employee.nombre,
                tipo,
                titulo: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
                bloquePeriodo: d.periodo ? ` (${d.periodo})` : '',
                bloqueFirma: requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : '',
              },
              ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
            })
          }))
      } catch (e) { console.error('[email/masivo] fallo:', e) }
    })()
  }

  return NextResponse.json({ uploaded: created.length })
}
