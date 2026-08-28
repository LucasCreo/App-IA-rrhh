/** Inspecciona los últimos jobs en la cola. Uso: npx tsx worker/scripts/checkJobs.ts */
import { prisma } from '@/lib/prisma'

async function main() {
  const jobs = await prisma.jobQueue.findMany({ orderBy: { id: 'desc' }, take: 5 })
  console.table(jobs.map(j => ({
    id: j.id, tipo: j.tipo, estado: j.estado, attempts: j.attempts,
    nextRunAt: j.nextRunAt.toISOString(), error: j.error?.slice(0, 40) ?? null,
  })))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
