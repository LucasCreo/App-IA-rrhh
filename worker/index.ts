/**
 * Entry point del worker. Corre en un proceso Node aparte del web Next.js
 * y consume la tabla JobQueue.
 *
 * Fase 2: solo maneja jobs `PING` (para probar el flujo).
 * Fase 3 sumará `INGEST_SFTP` y `PROCESS_ARCHIVO`.
 *
 * Vars de entorno relevantes:
 *   DATABASE_URL         - misma que el web
 *   WORKER_LOG_LEVEL     - debug | info | warn | error (default info)
 *   WORKER_ID_SUFFIX     - opcional, sirve para distinguir instancias
 */
import { hostname } from 'os'
import { runJobLoop } from './jobRunner'
import { runSftpWatcher } from './sftpWatcher'
import { tiposSoportados } from './handlers'
import { logger } from './logger'

const workerId = [
  hostname(),
  process.pid,
  process.env.WORKER_ID_SUFFIX ?? Math.random().toString(36).slice(2, 6),
].join('-')

async function main() {
  logger.info('worker starting', { workerId, node: process.version })

  const stopJobs = runJobLoop({ workerId, tipos: tiposSoportados() })
  const stopWatcher = runSftpWatcher()

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info('shutdown', { signal })
    try {
      await Promise.all([stopJobs(), stopWatcher()])
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => { void shutdown('SIGINT') })
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
}

main().catch(err => {
  logger.error('fatal', { error: err instanceof Error ? err.stack : String(err) })
  process.exit(1)
})
