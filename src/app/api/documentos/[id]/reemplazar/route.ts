import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import { updateAditusFile, uploadAditusFile } from '@/lib/aditus'
import { reciboProps } from '@/lib/aditusRecibos'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const docId = Number(id)

  const existing = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      employee: { select: { legajo: true, nombre: true, apellido: true, cuil: true } },
      lote: { select: { nombre: true } },
    },
  })
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
  if (buffer.length > MAX_PDF_SIZE) {
    return NextResponse.json({ error: `${file.name}: supera el límite de 10 MB` }, { status: 400 })
  }
  if (!isPdfBuffer(buffer)) {
    return NextResponse.json({ error: `${file.name}: no es un PDF válido` }, { status: 400 })
  }

  const props = reciboProps({
    empleado: existing.employee,
    periodo: existing.periodo,
    loteNombre: existing.lote?.nombre ?? null,
  })

  let aditusId = existing.aditusId
  try {
    if (aditusId) {
      await updateAditusFile(aditusId, {
        content: buffer,
        fileName: file.name,
        contentType: 'application/pdf',
        properties: props,
      })
    } else {
      aditusId = await uploadAditusFile({
        content: buffer,
        fileName: file.name,
        contentType: 'application/pdf',
        properties: props,
      })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
  }

  await prisma.document.update({
    where: { id: docId },
    data: {
      nombreArchivo: file.name,
      aditusId,
      estado: 'BORRADOR',
      fechaFirma: null,
    },
  })

  await logAction(user.userId, 'REEMPLAZAR', 'Documento', `ID ${docId}: ${file.name}`)
  return NextResponse.json({ ok: true })
}
