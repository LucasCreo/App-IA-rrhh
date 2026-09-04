/**
 * Recalcula progreso y estado de un lote SFTP. Se llama desde:
 *  - Worker (PROCESS_ARCHIVO y INGEST_SFTP hash-duplicado)
 *  - Web (DELETE/ASIGNAR de LoteArchivoPendiente)
 *
 * "Terminó" = todos los ingestados están procesados (documents + pendientes)
 * y no hay ingest jobs en cola. Si terminó y hay pendientes → CON_ERRORES,
 * si no → LISTO. Al primer cruce a estado final, dispara email.
 */
import { prisma } from './prisma'
import { sendMailFromTemplate } from './emailTemplates'

export async function actualizarProgresoLote(loteId: number): Promise<void> {
  const [totalIngestados, documentsCount, pendientesCount, estadoAnterior] = await Promise.all([
    prisma.sftpArchivoProcesado.count({ where: { loteId } }),
    prisma.document.count({ where: { loteId } }),
    prisma.loteArchivoPendiente.count({ where: { loteId } }),
    prisma.lote.findUnique({
      where: { id: loteId },
      select: { estado: true, nombre: true, origen: true },
    }),
  ])
  const procesados = documentsCount + pendientesCount
  const total = Math.max(totalIngestados, procesados)
  const progreso = total === 0 ? 0 : Math.min(100, Math.round(procesados / total * 100))

  // Lotes manuales: no hay procesamiento async, el estado es solo función
  // de si quedan pendientes. Nunca pasa por PROCESANDO.
  // Lotes SFTP: PROCESANDO mientras haya ingestados sin procesar; al terminar,
  // LISTO o CON_ERRORES. Si más adelante llegan archivos nuevos, totalIngestados
  // crece y el lote vuelve a PROCESANDO en el próximo update.
  let nuevoEstado: string
  if (estadoAnterior?.origen === 'SFTP') {
    const termino = totalIngestados > 0 && procesados >= totalIngestados
    nuevoEstado = termino
      ? (pendientesCount > 0 ? 'CON_ERRORES' : 'LISTO')
      : 'PROCESANDO'
  } else {
    // Manual: no tocar estado CERRADO. Para el resto, LISTO / CON_ERRORES según pendientes.
    if (estadoAnterior?.estado === 'CERRADO') {
      nuevoEstado = 'CERRADO'
    } else {
      nuevoEstado = pendientesCount > 0 ? 'CON_ERRORES' : 'LISTO'
    }
  }
  await prisma.lote.update({
    where: { id: loteId },
    data: { progreso, estado: nuevoEstado },
  })

  const eraProcesando = estadoAnterior?.estado === 'PROCESANDO'
  const esFinal = nuevoEstado === 'LISTO' || nuevoEstado === 'CON_ERRORES'
  if (eraProcesando && esFinal && estadoAnterior?.origen === 'SFTP') {
    notificarLoteProcesado(loteId, estadoAnterior.nombre, documentsCount, pendientesCount)
      .catch(e => console.warn('[loteProgress] email lote_procesado fail', loteId, e instanceof Error ? e.message : String(e)))
  }
}

async function notificarLoteProcesado(loteId: number, nombreLote: string, asignados: number, pendientes: number) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', email: { not: '' } },
    select: { email: true },
  })
  if (admins.length === 0) return
  const bloqueErrores = pendientes > 0
    ? `<p>Quedaron <strong>${pendientes}</strong> archivo${pendientes !== 1 ? 's' : ''} sin asignar. Revisalos en el lote.</p>`
    : ''
  await Promise.all(admins.map(a => sendMailFromTemplate('LOTE_PROCESADO', {
    to: a.email,
    vars: {
      nombreLote,
      asignados: String(asignados),
      pendientes: String(pendientes),
      bloqueErrores,
    },
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/lotes/${loteId}`,
  })))
}
