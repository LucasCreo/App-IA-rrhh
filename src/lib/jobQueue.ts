/**
 * Cola de trabajos genérica sobre SQL Server.
 * Diseño:
 *  - `enqueue()` crea un job PENDING con nextRunAt = ahora.
 *  - `claim()` toma UN job atómicamente con UPDATE TOP(1) ... OUTPUT WHERE
 *    estado = 'PENDING' AND nextRunAt <= now. Marca CLAIMED y atributos del
 *    worker + incrementa attempts.
 *  - `complete()` marca DONE.
 *  - `fail()` reagenda con backoff exponencial (2^attempts * baseSec) hasta
 *    maxAttempts; luego FAILED.
 *  - `reclaimStale()` libera jobs cuyo claimedAt es viejo (worker muerto).
 *
 * No hay lockeo pesimista de larga duración: el claim + heartbeat
 * (opcional) alcanza. Múltiples workers pueden coexistir sin doble-procesar.
 */
import { prisma } from './prisma'

export type JobEstado = 'PENDING' | 'CLAIMED' | 'DONE' | 'FAILED'

export interface JobRecord<P = unknown> {
  id: number
  tipo: string
  payload: P
  attempts: number
  maxAttempts: number
}

export interface EnqueueOptions {
  maxAttempts?: number
  delaySeconds?: number
}

/** Crea un job PENDING. */
export async function enqueue<P>(tipo: string, payload: P, opts: EnqueueOptions = {}): Promise<number> {
  const nextRunAt = new Date(Date.now() + (opts.delaySeconds ?? 0) * 1000)
  const created = await prisma.jobQueue.create({
    data: {
      tipo,
      payload: payload == null ? null : JSON.stringify(payload),
      estado: 'PENDING',
      maxAttempts: opts.maxAttempts ?? 3,
      nextRunAt,
    },
    select: { id: true },
  })
  return created.id
}

/**
 * Toma atómicamente 1 job PENDING elegible. Devuelve null si no hay.
 * Filtra por tipos si se especifica (vacío = cualquier tipo).
 */
export async function claim<P = unknown>(
  workerId: string,
  tipos: string[] = [],
): Promise<JobRecord<P> | null> {
  const now = new Date()
  // UPDATE TOP(1) con OUTPUT es la forma atómica en SQL Server para claim
  // sin lockear una tabla entera. WITH (ROWLOCK, READPAST) permite que otros
  // workers salteen filas ya lockeadas y no se bloqueen.
  const tipoFilter = tipos.length > 0
    ? `AND [tipo] IN (${tipos.map((_, i) => `@P${i + 3}`).join(',')})`
    : ''
  const sql = `
    UPDATE TOP (1) [JobQueue]
      WITH (ROWLOCK, READPAST)
    SET [estado] = 'CLAIMED',
        [claimedBy] = @P1,
        [claimedAt] = @P2,
        [attempts] = [attempts] + 1,
        [updatedAt] = @P2
    OUTPUT inserted.[id], inserted.[tipo], inserted.[payload], inserted.[attempts], inserted.[maxAttempts]
    WHERE [estado] = 'PENDING' AND [nextRunAt] <= @P2 ${tipoFilter}
  `
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; tipo: string; payload: string | null; attempts: number; maxAttempts: number
  }>>(sql, workerId, now, ...tipos)
  if (rows.length === 0) return null
  const r = rows[0]
  let parsed: P = null as unknown as P
  if (r.payload != null) {
    try { parsed = JSON.parse(r.payload) as P } catch { parsed = null as unknown as P }
  }
  return { id: r.id, tipo: r.tipo, payload: parsed, attempts: r.attempts, maxAttempts: r.maxAttempts }
}

/** Marca DONE. */
export async function complete(jobId: number): Promise<void> {
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: { estado: 'DONE', finishedAt: new Date(), error: null },
  })
}

/**
 * Marca FAILED si superó maxAttempts. Si aún quedan intentos, reagenda con
 * backoff exponencial (2^attempts * baseSeconds, cap 30 min).
 */
export async function fail(jobId: number, err: unknown, baseBackoffSec = 30): Promise<void> {
  const j = await prisma.jobQueue.findUnique({ where: { id: jobId } })
  if (!j) return
  const errorMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  if (j.attempts >= j.maxAttempts) {
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: { estado: 'FAILED', finishedAt: new Date(), error: errorMsg.slice(0, 4000) },
    })
    return
  }
  const backoffSec = Math.min(1800, baseBackoffSec * Math.pow(2, j.attempts))
  const nextRunAt = new Date(Date.now() + backoffSec * 1000)
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      estado: 'PENDING',
      claimedBy: null,
      claimedAt: null,
      nextRunAt,
      error: errorMsg.slice(0, 4000),
    },
  })
}

/**
 * Libera jobs CLAIMED cuyo claimedAt es más viejo que `staleMinutes`.
 * Los deja PENDING otra vez para que otro worker los tome. Sirve para
 * recuperarse de un worker que crasheó sin liberar el job.
 */
export async function reclaimStale(staleMinutes = 15): Promise<number> {
  const threshold = new Date(Date.now() - staleMinutes * 60 * 1000)
  const res = await prisma.jobQueue.updateMany({
    where: { estado: 'CLAIMED', claimedAt: { lt: threshold } },
    data: { estado: 'PENDING', claimedBy: null, claimedAt: null },
  })
  return res.count
}
