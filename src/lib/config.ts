import { prisma } from './prisma'

interface AppConfig {
  editWindowMin: number
  firmaMinSec: number
  soporteEmail: string | null
  soporteTel: string | null
}

let cache: { data: AppConfig; ts: number } | null = null
const CACHE_MS = 60_000

export async function getConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data
  const c = await prisma.generalConfig.findFirst()
  const data: AppConfig = {
    editWindowMin: c?.editWindowMin ?? 1440,
    firmaMinSec: c?.firmaMinSec ?? 10,
    soporteEmail: c?.soporteEmail ?? null,
    soporteTel: c?.soporteTel ?? null,
  }
  cache = { data, ts: Date.now() }
  return data
}

export function invalidateConfigCache() {
  cache = null
}
