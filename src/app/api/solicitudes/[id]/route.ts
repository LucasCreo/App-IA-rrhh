import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermiso, getCurrentUser } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { isAncestorOfUser, getScopedEmployeeIds } from '@/lib/scope'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { deleteAditusFile, updateAditusFileMetadata } from '@/lib/aditus'
import { parseArchivoRef } from '@/lib/aditusSolicitudes'
import { solicitudProps } from '@/lib/aditusSolicitudes'

const patchSchema = z.object({
  estado: z.enum(['APROBADO', 'RECHAZADO']),
  comentario: z.string().max(2000).optional().nullable(),
  comentarioVisible: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { estado, comentario, comentarioVisible } = parsed.data

  const actual = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
  const solicitanteUserId = actual?.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  // Lock optimista: solo actualiza si la solicitud sigue PENDIENTE.
  // Previene doble-resolución si dos admins la abren a la vez.
  const claim = await prisma.solicitudDocumento.updateMany({
    where: { id: Number(id), estado: 'PENDIENTE' },
    data: {
      estado,
      comentario: comentario?.trim() || null,
      comentarioVisible: comentario?.trim() ? (comentarioVisible ?? false) : false,
    },
  })
  if (claim.count === 0) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada por otro administrador' }, { status: 409 })
  }
  const solicitud = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true, cuil: true, email: true } },
      tipo: true,
    },
  })
  if (solicitud?.employee?.email) {
    sendMailFromTemplate('SOLICITUD_DOC_RESUELTA', {
      to: solicitud.employee.email,
      vars: {
        nombre: solicitud.employee.nombre,
        tipo: solicitud.tipo.nombre,
        resultado: estado === 'APROBADO' ? 'aprobada' : 'rechazada',
        bloqueComentario: comentario?.trim() && comentarioVisible
          ? `<p><em>Comentario del administrador:</em> ${comentario.trim()}</p>`
          : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/solicitudes`,
    }).catch(e => console.error('[email/solicitud-resuelta] fallo:', e))
  }

  // Actualizar detalles del adjunto en Aditus (best-effort)
  if (solicitud?.nombreArchivo) {
    const { aditusId, nombre } = parseArchivoRef(solicitud.nombreArchivo)
    if (aditusId && solicitud.employee) {
      const fecha = new Date().toLocaleDateString('es-AR')
      const detalles = `Solicitud ${estado} el ${fecha}${comentario?.trim() ? ` — Comentario: ${comentario.trim()}` : ''}`
      updateAditusFileMetadata(aditusId, solicitudProps({
        empleado: { legajo: solicitud.employee.legajo, cuil: solicitud.employee.cuil },
        tipoNombre: solicitud.tipo.nombre,
        fileName: nombre,
        detalles,
      })).catch(e => console.error('[aditus/solicitud-resuelta] update metadata fail:', e))
    }
  }
  return NextResponse.json(solicitud)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const solicitud = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    select: { employeeId: true, nombreArchivo: true, estado: true },
  })
  if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Empleado dueño solo si está PENDIENTE; admin con permiso puede siempre.
  const esDueno = user.employeeId === solicitud.employeeId
  if (esDueno && user.role !== 'ADMIN') {
    if (solicitud.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Solo podés eliminar solicitudes pendientes' }, { status: 400 })
    }
  } else {
    const admin = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
    if (!admin) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    const scope = await getScopedEmployeeIds(admin.userId)
    if (scope && !scope.has(solicitud.employeeId)) {
      return NextResponse.json({ error: 'No autorizado sobre esta solicitud' }, { status: 403 })
    }
  }

  await prisma.solicitudDocumento.delete({ where: { id: Number(id) } })

  // Limpiar adjunto en Aditus (best-effort)
  if (solicitud.nombreArchivo) {
    const { aditusId } = parseArchivoRef(solicitud.nombreArchivo)
    if (aditusId) deleteAditusFile(aditusId).catch(e => console.error('[aditus/solicitud-delete] fail:', e))
  }

  return NextResponse.json({ ok: true })
}
