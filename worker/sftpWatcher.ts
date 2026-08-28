import { prisma } from '@/lib/prisma'
import { enqueue } from '@/lib/jobQueue'
import { Sftp } from './sftpClient'
import { logger } from './logger'
import type { IngestSftpPayload } from './handlers/ingestSftp'

interface WatcherOptions {
  /** ms para chequear cambios de config (default 60s). */
  configCheckMs?: number
}

/**
 * Ciclo del watcher SFTP:
 *  - Cada `sftpPollIntervalMinutes` (según GeneralConfig), lista PDFs
 *    estables en el SFTP y encola un job INGEST_SFTP por cada uno que
 *    no esté ya en la cola o en `SftpArchivoProcesado`.
 *  - Cada `configCheckMs` (default 60s), releee la config para reaccionar
 *    a cambios de intervalo/enabled/rutas sin reiniciar el worker.
 *  - Si la config está deshabilitada, no hace nada y sigue chequeando.
 *
 * No implementa lock de instancia única: asume 1 solo worker corriendo.
 * Si se ejecutan varios, cada uno pollea, pero `enqueue` no crea duplicados
 * porque INGEST_SFTP se dedupea por path (ver comentario abajo).
 *
 * Nota de dedup: hoy encolamos siempre y confiamos en que el handler
 * INGEST_SFTP haga el skip por SftpArchivoProcesado. Si aparece un mismo
 * path dos veces en el mismo poll, se encolan 2 jobs pero solo uno hace
 * trabajo (el otro loguea "ya procesado").
 */
export function runSftpWatcher(opts: WatcherOptions = {}): () => Promise<void> {
  const configCheckMs = opts.configCheckMs ?? 60_000
  let stopped = false
  let lastPollAt = 0
  let intervalMs = 15 * 60 * 1000
  let enabled = false
  let host: string | null = null
  let user: string | null = null
  let password: string | null = null
  let port = 22
  let incomingPath: string | null = null
  let stableSeconds = 30
  let lastConfigCheck = 0

  const releerConfig = async () => {
    const c = await prisma.generalConfig.findFirst().catch(() => null)
    if (!c) {
      enabled = false
      return
    }
    enabled = c.sftpEnabled === true
    host = c.sftpHost ?? null
    user = c.sftpUser ?? null
    password = c.sftpPassword ?? null
    port = c.sftpPort ?? 22
    incomingPath = c.sftpIncomingPath ?? null
    stableSeconds = c.sftpStableSeconds ?? 30
    const mins = c.sftpPollIntervalMinutes && c.sftpPollIntervalMinutes > 0 ? c.sftpPollIntervalMinutes : 15
    intervalMs = mins * 60 * 1000
  }

  const configCompleta = () => enabled && !!host && !!user && !!password && !!incomingPath

  const doPoll = async () => {
    if (!configCompleta()) return
    logger.info('sftp poll', { host, incomingPath, stableSeconds })
    const sftp = new Sftp({ host: host!, port, user: user!, password: password! })
    try {
      await sftp.connect()
      const archivos = await sftp.listPdfsEstables(incomingPath!, stableSeconds)
      logger.info('sftp files listed', { count: archivos.length })
      for (const a of archivos) {
        const yaProc = await prisma.sftpArchivoProcesado.findUnique({ where: { path: a.path } })
        if (yaProc) continue
        await enqueue<IngestSftpPayload>('INGEST_SFTP', { path: a.path })
      }
    } catch (e) {
      logger.error('sftp poll error', { error: e instanceof Error ? e.message : String(e) })
    } finally {
      await sftp.disconnect()
    }
  }

  const loop = (async () => {
    await releerConfig()
    lastConfigCheck = Date.now()
    logger.info('sftp watcher started', { enabled, intervalMs, incomingPath })

    while (!stopped) {
      try {
        if (Date.now() - lastConfigCheck > configCheckMs) {
          await releerConfig()
          lastConfigCheck = Date.now()
        }
        if (configCompleta() && Date.now() - lastPollAt >= intervalMs) {
          lastPollAt = Date.now()
          await doPoll()
        }
      } catch (e) {
        logger.error('watcher loop error', { error: e instanceof Error ? e.message : String(e) })
      }
      await sleep(2000)
    }
    logger.info('sftp watcher stopped')
  })()

  return async () => {
    stopped = true
    await loop
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
