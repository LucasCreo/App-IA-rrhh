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
  const [totalIngestados, documentsCount, pendientesCount, ingestPendientes] = await Promise.all([
    prisma.sftpArchivoProcesado.count({ where: { loteId } }),
    prisma.document.count({ where: { loteId } }),
    prisma.loteArchivoPendiente.count({ where: { loteId } }),
    prisma.jobQueue.count({
      where: { tipo: 'INGEST_SFTP', estado: { in: ['PENDING', 'CLAIMED'] } },
    }),
  ])
  const procesados = documentsCount + pendientesCount
  const total = Math.max(totalIngestados, procesados)
  const progreso = total === 0 ? 0 : Math.min(100, Math.round(procesados / total * 100))

  const termino = ingestPendientes === 0 && procesados >= totalIngestados && totalIngestados > 0
  const nuevoEstado = termino
    ? (pendientesCount > 0 ? 'CON_ERRORES' : 'LISTO')
    : 'PROCESANDO'

  const estadoAnterior = await prisma.lote.findUnique({
    where: { id: loteId },
    select: { estado: true, nombre: true, origen: true },
  })
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
