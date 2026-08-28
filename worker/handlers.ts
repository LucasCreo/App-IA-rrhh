import type { JobRecord } from '@/lib/jobQueue'
import { logger } from './logger'
import { ingestSftpHandler } from './handlers/ingestSftp'
import { procesarArchivoHandler } from './handlers/procesarArchivo'

/**
 * Registry de handlers. Cada handler recibe el job crudo y lanza excepción
 * si algo falla — el runner se encarga de fail() con backoff.
 */
export type JobHandler = (job: JobRecord) => Promise<void>

/** Handler de prueba (verificar el flujo end-to-end). */
async function pingHandler(job: JobRecord): Promise<void> {
  logger.info('ping', { jobId: job.id, payload: job.payload, attempt: job.attempts })
}

export const HANDLERS: Record<string, JobHandler> = {
  PING: pingHandler,
  INGEST_SFTP: ingestSftpHandler as JobHandler,
  PROCESS_ARCHIVO: procesarArchivoHandler as JobHandler,
}

export function tiposSoportados(): string[] {
  return Object.keys(HANDLERS)
}

export async function dispatch(job: JobRecord): Promise<void> {
  const handler = HANDLERS[job.tipo]
  if (!handler) throw new Error(`No hay handler para tipo="${job.tipo}"`)
  await handler(job)
}
