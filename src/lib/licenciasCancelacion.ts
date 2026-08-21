import { prisma } from '@/lib/prisma'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { updateAditusFileMetadata } from '@/lib/aditus'
import { ausenciaProps, refFromArchivoUrl, parseArchivoRef } from '@/lib/aditusSolicitudes'

/** El empleado puede cancelar mientras la licencia no haya iniciado (comparación por día calendario). */

const fmt = (d: Date) => new Date(d).toLocaleDateString('es-AR')

interface CancelarInput {
  solicitudId: number
  actor: 'EMPLEADO' | 'ADMIN'
  motivo?: string | null
}

interface CancelarResult {
  ok: boolean
  status: number
  error?: string
  diasDevueltos?: number
}

/**
 * Cancela una solicitud de ausencia. Devuelve saldo si estaba APROBADA y afectaSaldo.
 * Notifica por email a la contraparte (admin ↔ empleado).
 * Concurrencia: usa updateMany con guard por estado para evitar race conditions.
 */
export async function cancelarSolicitudAusencia({ solicitudId, actor, motivo }: CancelarInput): Promise<CancelarResult> {
  const solicitud = await prisma.solicitudAusencia.findUnique({
    where: { id: solicitudId },
    include: {
      tipoAusencia: { select: { nombre: true, afectaSaldo: true } },
      employee: { select: { id: true, nombre: true, apellido: true, email: true, legajo: true, cuil: true } },
    },
  })
  if (!solicitud) return { ok: false, status: 404, error: 'No encontrada' }
  if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'APROBADA') {
    return { ok: false, status: 400, error: `No se puede cancelar en estado ${solicitud.estado}` }
  }

  const estadoPrevio = solicitud.estado
  const comentario = `Cancelada por ${actor === 'EMPLEADO' ? 'el empleado' : 'el administrador'}${motivo?.trim() ? `: ${motivo.trim()}` : ''}`

  const claim = await prisma.solicitudAusencia.updateMany({
    where: { id: solicitudId, estado: estadoPrevio },
    data: { estado: 'CANCELADA', comentarioAdmin: comentario },
  })
  if (claim.count === 0) {
    return { ok: false, status: 409, error: 'La solicitud cambió de estado, refrescá y probá de nuevo' }
  }

  // Actualizar metadata del adjunto en Aditus (best-effort, no bloqueante)
  if (solicitud.archivoUrl) {
    const ref = refFromArchivoUrl(solicitud.archivoUrl)
    if (ref) {
      const { aditusId, nombre } = parseArchivoRef(ref)
      if (aditusId) {
        const fechaCancel = new Date().toLocaleDateString('es-AR')
        const detalles = `Solicitud CANCELADA por ${actor === 'EMPLEADO' ? 'el empleado' : 'el administrador'} el ${fechaCancel}${motivo?.trim() ? ` — Motivo: ${motivo.trim()}` : ''}`
        updateAditusFileMetadata(aditusId, ausenciaProps({
          empleado: solicitud.employee,
          tipoAusenciaNombre: solicitud.tipoAusencia.nombre,
          fileName: nombre,
          detalles,
        })).catch(e => console.error('[aditus/cancelar] update metadata fail:', e))
      }
    }
  }

  // Devolver saldo si corresponde
  let diasDevueltos = 0
  if (estadoPrevio === 'APROBADA' && solicitud.tipoAusencia.afectaSaldo) {
    const anio = solicitud.fechaInicio.getFullYear()
    const saldo = await prisma.saldoVacaciones.findUnique({
      where: { employeeId_anio: { employeeId: solicitud.employeeId, anio } },
    })
    if (saldo && saldo.diasUsados > 0) {
      diasDevueltos = Math.min(solicitud.dias, saldo.diasUsados)
      await prisma.saldoVacaciones.update({
        where: { employeeId_anio: { employeeId: solicitud.employeeId, anio } },
        data: { diasUsados: { decrement: diasDevueltos } },
      })
    }
  }

  // Notificar (fire-and-forget)
  const rango = `${fmt(solicitud.fechaInicio)} — ${fmt(solicitud.fechaFin)}`
  const bloqueMotivo = motivo?.trim() ? `<p><em>Motivo:</em> ${motivo.trim()}</p>` : ''
  const bloqueSaldo = diasDevueltos > 0
    ? `<p>Se devolvieron <strong>${diasDevueltos}</strong> día${diasDevueltos !== 1 ? 's' : ''} al saldo de vacaciones.</p>`
    : ''

  if (actor === 'EMPLEADO') {
    // avisar a admins
    prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } })
      .then(admins => Promise.all(admins.map(a => sendMailFromTemplate('AUSENCIA_CANCELADA', {
        to: a.email,
        vars: {
          apellido: solicitud.employee.apellido,
          nombre: solicitud.employee.nombre,
          tipoAusencia: solicitud.tipoAusencia.nombre,
          rango,
          quien: 'el empleado',
          bloqueMotivo,
          bloqueSaldo,
        },
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/licencias`,
      }))))
      .catch(e => console.error('[email/ausencia-cancelada→admins] fallo:', e))
  } else {
    // avisar al empleado
    if (solicitud.employee.email) {
      sendMailFromTemplate('AUSENCIA_CANCELADA', {
        to: solicitud.employee.email,
        vars: {
          apellido: solicitud.employee.apellido,
          nombre: solicitud.employee.nombre,
          tipoAusencia: solicitud.tipoAusencia.nombre,
          rango,
          quien: 'el administrador',
          bloqueMotivo,
          bloqueSaldo,
        },
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/licencias`,
      }).catch(e => console.error('[email/ausencia-cancelada→empleado] fallo:', e))
    }
  }

  return { ok: true, status: 200, diasDevueltos }
}

/**
 * Un empleado solo puede cancelar la suya si el día de inicio es posterior a hoy
 * (comparación por fecha calendario, sin importar hora). Si ya comenzó, solo el admin.
 */
export function puedeEmpleadoCancelar(fechaInicio: Date): { ok: boolean; error?: string } {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(fechaInicio)
  inicio.setHours(0, 0, 0, 0)
  if (inicio.getTime() <= hoy.getTime()) {
    return {
      ok: false,
      error: 'La licencia ya inició. Pedile al administrador que la cancele.',
    }
  }
  return { ok: true }
}
