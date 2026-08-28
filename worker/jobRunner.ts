import { claim, complete, fail, reclaimStale } from '@/lib/jobQueue'
import { dispatch } from './handlers'
import { logger } from './logger'

interface RunLoopOptions {
  workerId: string
  tipos: string[]
  /** ms entre polls cuando no hay trabajo. Default 2000. */
  idleSleepMs?: number
  /** minutos para considerar un CLAIMED "muerto" y liberarlo. Default 15. */
  staleMinutes?: number
  /** segundos entre chequeos de stale. Default 60. */
  staleCheckIntervalSec?: number
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Loop principal del worker: reclaim de jobs colgados + claim + dispatch.
 * Devuelve una función `stop()` async para shutdown graceful.
 */
export function runJobLoop(opts: RunLoopOptions): () => Promise<void> {
  const idleSleepMs = opts.idleSleepMs ?? 2000
  const staleMinutes = opts.staleMinutes ?? 15
  const staleCheckMs = (opts.staleCheckIntervalSec ?? 60) * 1000
  let stopped = false
  let lastStaleCheck = 0

  logger.info('runner started', { workerId: opts.workerId, tipos: opts.tipos })

  const loop = (async () => {
    while (!stopped) {
      try {
        if (Date.now() - lastStaleCheck > staleCheckMs) {
          const reclaimed = await reclaimStale(staleMinutes)
          if (reclaimed > 0) logger.warn('reclaimed stale jobs', { count: reclaimed })
          lastStaleCheck = Date.now()
        }

        const job = await claim(opts.workerId, opts.tipos)
        if (!job) { await sleep(idleSleepMs); continue }

        logger.info('job claimed', { jobId: job.id, tipo: job.tipo, attempt: job.attempts })
        try {
          await dispatch(job)
          await complete(job.id)
          logger.info('job done', { jobId: job.id, tipo: job.tipo })
        } catch (err) {
          logger.error('job failed', {
            jobId: job.id, tipo: job.tipo, attempt: job.attempts, maxAttempts: job.maxAttempts,
            error: err instanceof Error ? err.message : String(err),
          })
          await fail(job.id, err)
        }
      } catch (loopErr) {
        // Error en el propio loop (BD caída, etc.): esperamos y reintentamos.
        logger.error('loop error', { error: loopErr instanceof Error ? loopErr.message : String(loopErr) })
        await sleep(5000)
      }
    }
    logger.info('runner stopped', { workerId: opts.workerId })
  })()

  return async () => {
    stopped = true
    await loop
  }
}
