import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import { uploadAditusFile, updateAditusFile } from '@/lib/aditus'
import { documentoGrupoProps } from '@/lib/aditusDocumentos'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)

  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    include: {
      tipoDocumento: { select: { nombre: true } },
      asignaciones: { select: { estado: true, employee: { select: { legajo: true } } } },
    },
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

  const props = documentoGrupoProps({
    nombreArchivo: file.name,
    tipoDocumentoNombre: grupo.tipoDocumento?.nombre ?? null,
    empleados: grupo.asignaciones.map(a => ({ legajo: a.employee.legajo })),
  })

  let aditusId = grupo.aditusId
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

  await prisma.$transaction([
    prisma.documentoGrupo.update({
      where: { id: grupoId },
      data: { nombreArchivo: file.name, aditusId },
    }),
    // Resetear asignaciones enviadas de vuelta a borrador (excepto rechazadas que quedan como están)
    prisma.documentoAsignacion.updateMany({
      where: { grupoId, estado: 'ENVIADO_A_FIRMA' },
      data: { estado: 'BORRADOR' },
    }),
  ])

  await logAction(user.userId, 'REEMPLAZAR_DOCUMENTO_GRUPO', 'Documento', `Grupo ${grupoId}: ${file.name}`)
  return NextResponse.json({ ok: true })
}
