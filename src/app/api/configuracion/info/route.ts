import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { readdir } from 'fs/promises'
import { join } from 'path'
import pkg from '@/../package.json'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [totalUsuarios, empleadosActivos, totalDocs, totalPosts] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.employee.count({ where: { estado: 'ACTIVO' } }).catch(() => 0),
    prisma.document.count().catch(() => 0),
    prisma.post.count().catch(() => 0),
  ])

  let lastMigration: string | null = null
  try {
    const dir = join(process.cwd(), 'prisma', 'migrations')
    const entries = await readdir(dir)
    const migs = entries.filter(n => /^\d/.test(n)).sort()
    lastMigration = migs[migs.length - 1] ?? null
  } catch { /* no-op */ }

  return NextResponse.json({
    version: (pkg as any).version ?? '0.0.0',
    lastMigration,
    counts: { totalUsuarios, empleadosActivos, totalDocs, totalPosts },
  })
}
