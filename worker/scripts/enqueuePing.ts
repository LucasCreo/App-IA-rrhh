/**
 * Encola un job PING para probar que el worker está andando.
 * Uso: npm run worker:enqueue-ping
 */
import { enqueue } from '@/lib/jobQueue'
import { prisma } from '@/lib/prisma'

async function main() {
  const id = await enqueue('PING', { at: new Date().toISOString(), from: 'cli' })
  console.log(`Encolado job PING id=${id}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
