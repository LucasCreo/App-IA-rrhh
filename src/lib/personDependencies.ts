import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { deleteAditusFile } from '@/lib/aditus'
import { parseArchivoRef, refFromArchivoUrl } from '@/lib/aditusSolicitudes'

async function tryUnlink(paths: string[]) {
  const results = await Promise.allSettled(paths.filter(Boolean).map(p => unlink(p)))
  const fallidos = results
    .map((r, i) => (r.status === 'rejected' ? paths[i] : null))
    .filter((p): p is string => !!p)
  if (fallidos.length > 0) {
    console.warn('[cleanup] archivos huérfanos que no pudieron eliminarse:', fallidos)
  }
}

async function tryDeleteAditus(ids: string[]) {
  const results = await Promise.allSettled(ids.filter(Boolean).map(id => deleteAditusFile(id)))
  const fallidos = results
    .map((r, i) => (r.status === 'rejected' ? ids[i] : null))
    .filter((p): p is string => !!p)
  if (fallidos.length > 0) {
    console.warn('[cleanup] archivos Aditus huérfanos que no pudieron eliminarse:', fallidos)
  }
}

export interface Dependencia {
  key: string
  label: string
  count: number
  href: string
}

export async function getEmployeeDependencies(employeeId: number): Promise<Dependencia[]> {
  const [
    documentos, ausencias, evaluaciones, respuestasFormulario, solicitudesDoc,
    solicitudesMod, eventos, saldosVac, valoresCampos, lotes,
  ] = await Promise.all([
    prisma.document.count({ where: { employeeId } }),
    prisma.solicitudAusencia.count({ where: { employeeId } }),
    prisma.evaluacion.count({ where: { employeeId } }),
    prisma.respuestaFormulario.count({ where: { employeeId } }),
    prisma.solicitudDocumento.count({ where: { employeeId } }),
    prisma.solicitudModificacion.count({ where: { employeeId } }),
    prisma.eventoEmpleado.count({ where: { employeeId } }),
    prisma.saldoVacaciones.count({ where: { employeeId } }),
    prisma.valorCampoEmpleado.count({ where: { employeeId } }),
    prisma.loteEmpleado.count({ where: { employeeId } }),
  ])
  void valoresCampos
  return [
    { key: 'documentos',      label: 'Documentos recibidos',       count: documentos,           href: '/admin/documentos' },
    { key: 'ausencias',       label: 'Ausencias',                  count: ausencias,            href: '/admin/calendario' },
    { key: 'evaluaciones',    label: 'Evaluaciones',               count: evaluaciones,         href: '/admin/evaluaciones' },
    { key: 'formularios',     label: 'Respuestas de formularios',  count: respuestasFormulario, href: '/admin/solicitudes?tab=enviadas' },
    { key: 'solicitudesDoc',  label: 'Solicitudes de documento',   count: solicitudesDoc,       href: '/admin/solicitudes' },
    { key: 'solicitudesMod',  label: 'Solicitudes de modificación', count: solicitudesMod,      href: `/admin/empleados/${employeeId}` },
    { key: 'eventos',         label: 'Eventos asignados',          count: eventos,              href: '/admin/calendario' },
    { key: 'saldosVac',       label: 'Saldos de vacaciones',       count: saldosVac,            href: '/admin/calendario' },
    { key: 'lotes',           label: 'Lotes de recibos',           count: lotes,                href: '/admin/recibos' },
  ].filter(d => d.count > 0)
}

export async function getUserDependencies(userId: number): Promise<Dependencia[]> {
  const [
    documentosCargados, lotesCreados, eventosCreados, posts, comentarios, reacciones,
  ] = await Promise.all([
    prisma.document.count({ where: { cargadoPorId: userId } }),
    prisma.lote.count({ where: { creadoPorId: userId } }),
    prisma.evento.count({ where: { creadoPorId: userId } }),
    prisma.post.count({ where: { autorId: userId } }),
    prisma.postComment.count({ where: { autorId: userId } }),
    prisma.postReaction.count({ where: { userId } }),
  ])
  return [
    { key: 'docsCargados',   label: 'Documentos subidos',    count: documentosCargados, href: '/admin/documentos' },
    { key: 'lotesCreados',   label: 'Lotes creados',         count: lotesCreados,       href: '/admin/recibos' },
    { key: 'eventosCreados', label: 'Eventos creados',       count: eventosCreados,     href: '/admin/calendario' },
    { key: 'posts',          label: 'Publicaciones',         count: posts,              href: '/admin/portal' },
    { key: 'comentarios',    label: 'Comentarios en el feed', count: comentarios,       href: '/admin/portal' },
    { key: 'reacciones',     label: 'Reacciones en el feed',  count: reacciones,        href: '/admin/portal' },
  ].filter(d => d.count > 0)
}

/**
 * Elimina en cascada empleado + user (y datos livianos: valoresCampos, saldosVac, loteEmpleado, resetTokens, auditLogs).
 * Los "duros" (documentos, ausencias, etc.) NO se tocan — deben venir en 0.
 */
export async function deletePersona(
  employeeId: number | null,
  userId: number | null
) {
  await prisma.$transaction(async tx => {
    if (employeeId) {
      await tx.valorCampoEmpleado.deleteMany({ where: { employeeId } })
      await tx.saldoVacaciones.deleteMany({ where: { employeeId } })
      await tx.loteEmpleado.deleteMany({ where: { employeeId } })
      await tx.userInvitation.deleteMany({ where: { employeeId } })
    }
    if (userId) {
      await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.auditLog.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    }
    if (employeeId) {
      await tx.employee.delete({ where: { id: employeeId } })
    }
  })
}

/**
 * DESTRUCTIVA: elimina TODO lo asociado al empleado/user, incluyendo documentos, ausencias,
 * evaluaciones, posts, lotes creados, etc. Sólo usar tras confirmación explícita del usuario.
 */
export async function deletePersonaCascade(
  employeeId: number | null,
  userId: number | null
) {
  // Recolectar refs a archivos ANTES del transaction para borrarlos después
  const filesToDelete: string[] = []
  const aditusIdsToDelete: string[] = []
  if (employeeId) {
    const docs = await prisma.document.findMany({ where: { employeeId }, select: { aditusId: true } })
    aditusIdsToDelete.push(...docs.map(d => d.aditusId!).filter(Boolean))

    // Ausencias: archivoUrl ahora es una URL de nuestro endpoint con ?file=<ref>
    const ausencias = await prisma.solicitudAusencia.findMany({
      where: { employeeId, archivoUrl: { not: null } }, select: { archivoUrl: true },
    })
    for (const a of ausencias) {
      if (!a.archivoUrl) continue
      const ref = refFromArchivoUrl(a.archivoUrl)
      if (ref) {
        const { aditusId } = parseArchivoRef(ref)
        if (aditusId) aditusIdsToDelete.push(aditusId)
      } else {
        // legacy: /uploads/ausencias/...
        filesToDelete.push(a.archivoUrl)
      }
    }

    // Respuestas de formulario: scan datos JSON por campos tipo archivo
    const respuestas = await prisma.respuestaFormulario.findMany({
      where: { employeeId },
      select: { datos: true, asignacion: { select: { plantilla: { select: { campos: { select: { nombre: true, tipo: true } } } } } } },
    })
    for (const r of respuestas) {
      const archivoNombres = new Set(r.asignacion.plantilla.campos.filter(c => c.tipo === 'archivo').map(c => c.nombre))
      try {
        const datos = JSON.parse(r.datos) as Record<string, string>
        for (const [k, v] of Object.entries(datos)) {
          if (archivoNombres.has(k) && typeof v === 'string' && v) {
            const { aditusId } = parseArchivoRef(v)
            if (aditusId) aditusIdsToDelete.push(aditusId)
          }
        }
      } catch { /* ignorar */ }
    }

    // Solicitudes de documento: scan metadata JSON por campos tipo archivo
    const solicitudes = await prisma.solicitudDocumento.findMany({
      where: { employeeId },
      select: { metadata: true, tipo: { select: { campos: true } } },
    })
    for (const s of solicitudes) {
      try {
        const campos = (Array.isArray(s.tipo.campos) ? s.tipo.campos : JSON.parse(String(s.tipo.campos))) as Array<{ nombre: string; tipo: string }>
        const archivoNombres = new Set(campos.filter(c => c.tipo === 'archivo').map(c => c.nombre))
        const meta = JSON.parse(s.metadata ?? '{}') as Record<string, string>
        for (const [k, v] of Object.entries(meta)) {
          if (archivoNombres.has(k) && typeof v === 'string' && v) {
            const { aditusId } = parseArchivoRef(v)
            if (aditusId) aditusIdsToDelete.push(aditusId)
          }
        }
      } catch { /* ignorar */ }
    }
  }
  if (userId) {
    const docs = await prisma.document.findMany({ where: { cargadoPorId: userId }, select: { aditusId: true } })
    aditusIdsToDelete.push(...docs.map(d => d.aditusId!).filter(Boolean))
  }

  await prisma.$transaction(async tx => {
    // 1) Empleado: desengancharlo del árbol y borrar dependencias
    if (employeeId) {
      await tx.valorCampoEmpleado.deleteMany({ where: { employeeId } })
      await tx.saldoVacaciones.deleteMany({ where: { employeeId } })
      await tx.loteEmpleado.deleteMany({ where: { employeeId } })
      await tx.eventoEmpleado.deleteMany({ where: { employeeId } })
      await tx.respuestaFormulario.deleteMany({ where: { employeeId } })
      await tx.evaluacion.deleteMany({ where: { employeeId } })
      await tx.solicitudAusencia.deleteMany({ where: { employeeId } })
      await tx.solicitudDocumento.deleteMany({ where: { employeeId } })
      await tx.solicitudModificacion.deleteMany({ where: { employeeId } })
      await tx.document.deleteMany({ where: { employeeId } })
      await tx.userInvitation.deleteMany({ where: { employeeId } })
    }

    // 2) User: borrar todo lo que creó (documentos, lotes, eventos, posts, comentarios, reacciones)
    if (userId) {
      // Desengancharlo del árbol de subordinados
      await tx.user.updateMany({ where: { managerUserId: userId }, data: { managerUserId: null } })
      // Documentos cargados por él (para OTROS empleados también — cargadoPorId es NOT NULL)
      await tx.document.deleteMany({ where: { cargadoPorId: userId } })
      // Lotes creados: primero soltar docs que apunten al lote y no fueron borrados
      const lotesUser = await tx.lote.findMany({ where: { creadoPorId: userId }, select: { id: true } })
      const loteIds = lotesUser.map(l => l.id)
      if (loteIds.length > 0) {
        await tx.document.updateMany({ where: { loteId: { in: loteIds } }, data: { loteId: null } })
        await tx.loteEmpleado.deleteMany({ where: { loteId: { in: loteIds } } })
        await tx.lote.deleteMany({ where: { id: { in: loteIds } } })
      }
      // Eventos creados por él (EventoEmpleado cascadea)
      await tx.evento.deleteMany({ where: { creadoPorId: userId } })
      // Posts / comments / reactions
      await tx.postComment.deleteMany({ where: { autorId: userId } })
      await tx.postReaction.deleteMany({ where: { userId } })
      await tx.post.deleteMany({ where: { autorId: userId } })
      // Audit y tokens
      await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.auditLog.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    }

    // 3) Empleado al final (por FK de User.employeeId)
    if (employeeId) {
      await tx.employee.delete({ where: { id: employeeId } })
    }
  })

  // Fuera del transaction: borrar archivos (best-effort)
  await tryUnlink(filesToDelete)
  await tryDeleteAditus(aditusIdsToDelete)
}
