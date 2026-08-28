import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getScopedEmployeeIds } from '@/lib/scope'

/**
 * Server-Sent Events con snapshot de estado/progreso de los lotes visibles.
 * Cliente: `new EventSource('/api/lotes/eventos')`.
 *
 * Poll interno cada 2s. Solo emite un evento cuando algún lote cambió
 * `estado` o `progreso`, para no saturar la red.
 *
 * Runtime nodejs (Prisma no anda en edge) y sin caching.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLL_MS = 2000
const HEARTBEAT_MS = 20_000

export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return new Response('Forbidden', { status: 403 })

  const scope = await getScopedEmployeeIds(user.userId)
  const where = scope ? { empleados: { some: { employeeId: { in: [...scope] } } } } : {}

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { closed = true }
      }

      // Snapshot inicial + tracking de deltas
      let last: Map<number, { estado: string; progreso: number }> = new Map()

      const snapshot = async () => {
        const lotes = await prisma.lote.findMany({
          where,
          select: { id: true, estado: true, progreso: true, nombre: true, origen: true },
          orderBy: { id: 'desc' },
          take: 500,
        })
        return lotes
      }

      const inicial = await snapshot()
      last = new Map(inicial.map(l => [l.id, { estado: l.estado, progreso: l.progreso }]))
      send('snapshot', inicial)

      const pollTimer = setInterval(async () => {
        if (closed) return
        try {
          const actual = await snapshot()
          const changes: Array<{ id: number; estado: string; progreso: number; nombre: string; origen: string }> = []
          const currentIds = new Set<number>()
          for (const l of actual) {
            currentIds.add(l.id)
            const prev = last.get(l.id)
            if (!prev || prev.estado !== l.estado || prev.progreso !== l.progreso) {
              changes.push(l)
              last.set(l.id, { estado: l.estado, progreso: l.progreso })
            }
          }
          // Detectar lotes nuevos (no estaban en el snapshot anterior)
          const nuevos = actual.filter(l => currentIds.has(l.id) && !inicial.some(i => i.id === l.id))
          // Detectar lotes borrados
          for (const id of last.keys()) {
            if (!currentIds.has(id)) {
              last.delete(id)
              changes.push({ id, estado: '__DELETED__', progreso: 0, nombre: '', origen: '' })
            }
          }
          if (changes.length > 0 || nuevos.length > 0) {
            send('update', { changes, nuevos })
          }
        } catch (e) {
          send('error', { message: e instanceof Error ? e.message : 'poll error' })
        }
      }, POLL_MS)

      const heartbeat = setInterval(() => {
        if (closed) return
        try { controller.enqueue(encoder.encode(': ping\n\n')) } catch { closed = true }
      }, HEARTBEAT_MS)

      const cleanup = () => {
        closed = true
        clearInterval(pollTimer)
        clearInterval(heartbeat)
        try { controller.close() } catch { /* ignore */ }
      }

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
