import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds, isAncestorOfUser } from '@/lib/scope'
import { cancelarSolicitudAusencia } from '@/lib/licenciasCancelacion'
import { updateAditusFileMetadata } from '@/lib/aditus'
import { ausenciaProps, refFromArchivoUrl, parseArchivoRef } from '@/lib/aditusSolicitudes'

const patchSchema = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA', 'CANCELADA']),
  comentarioAdmin: z.string().max(2000).optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { estado, comentarioAdmin } = parsed.data

  const solicitud = await prisma.solicitudAusencia.findUnique({
    where: { id: Number(id) },
    include: { tipoAusencia: true, employee: { select: { user: { select: { id: true } } } } },
  })
  if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(solicitud.employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre esta solicitud' }, { status: 403 })
  }

  // Cancelación: se puede desde PENDIENTE o APROBADA (revierte saldo). Delegamos al helper.
  if (estado === 'CANCELADA') {
    const res = await cancelarSolicitudAusencia({
      solicitudId: Number(id),
      actor: 'ADMIN',
      motivo: comentarioAdmin ?? null,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ ok: true, diasDevueltos: res.diasDevueltos })
  }

  if (solicitud.estado !== 'PENDIENTE')
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 })

  // Solo un ancestro en el organigrama puede aprobar/rechazar (nunca uno mismo)
  const solicitanteUserId = solicitud.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  // updateMany con filtro por estado = 'PENDIENTE' actúa como lock optimista:
  // si otro admin ya la resolvió, count = 0 y abortamos antes de duplicar eventos/saldo.
  const claim = await prisma.solicitudAusencia.updateMany({
    where: { id: Number(id), estado: 'PENDIENTE' },
    data: { estado, comentarioAdmin: comentarioAdmin ?? null },
  })
  if (claim.count === 0) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada por otro administrador' }, { status: 409 })
  }

  if (estado === 'APROBADA') {
    // No creamos Evento: /api/eventos ya expone las ausencias aprobadas como
    // eventos virtuales, así que crear uno real duplicaría la entrada en el calendario.

    // Descontar del saldo de vacaciones si aplica
    if (solicitud.tipoAusencia.afectaSaldo) {
      const anio = solicitud.fechaInicio.getFullYear()
      await prisma.saldoVacaciones.upsert({
        where: { employeeId_anio: { employeeId: solicitud.employeeId, anio } },
        update: { diasUsados: { increment: solicitud.dias } },
        create: { employeeId: solicitud.employeeId, anio, diasTotales: 14, diasUsados: solicitud.dias },
      })
    }
  }

  // Actualizar detalles del adjunto en Aditus (best-effort)
  if (solicitud.archivoUrl) {
    const ref = refFromArchivoUrl(solicitud.archivoUrl)
    if (ref) {
      const { aditusId, nombre } = parseArchivoRef(ref)
      if (aditusId) {
        const empFull = await prisma.employee.findUnique({
          where: { id: solicitud.employeeId },
          select: { legajo: true, cuil: true },
        })
        if (empFull) {
          const fecha = new Date().toLocaleDateString('es-AR')
          const detalles = `Solicitud ${estado} el ${fecha}${comentarioAdmin?.trim() ? ` — Comentario: ${comentarioAdmin.trim()}` : ''}`
          updateAditusFileMetadata(aditusId, ausenciaProps({
            empleado: empFull,
            tipoAusenciaNombre: solicitud.tipoAusencia.nombre,
            fileName: nombre,
            detalles,
          })).catch(e => console.error('[aditus/ausencia-resuelta] update metadata fail:', e))
        }
      }
    }
  }

  // Notificar al empleado por email
  const emp = await prisma.employee.findUnique({
    where: { id: solicitud.employeeId },
    select: { nombre: true, email: true },
  })
  if (emp?.email) {
    const fmt = (d: Date) => new Date(d).toLocaleDateString('es-AR')
    const rango = `${fmt(solicitud.fechaInicio)} — ${fmt(solicitud.fechaFin)}`
    const esAprobada = estado === 'APROBADA'
    // Fire-and-forget
    sendMailFromTemplate('AUSENCIA_RESUELTA', {
      to: emp.email,
      vars: {
        nombre: emp.nombre,
        tipoAusencia: solicitud.tipoAusencia.nombre,
        rango,
        resultado: esAprobada ? 'aprobada' : 'rechazada',
        bloqueComentario: comentarioAdmin ? `<p><em>Comentario del administrador:</em> ${comentarioAdmin}</p>` : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/licencias`,
    }).catch(e => console.error('[email/ausencia-resolucion] fallo:', e))
  }

  return NextResponse.json({ ok: true })
}
