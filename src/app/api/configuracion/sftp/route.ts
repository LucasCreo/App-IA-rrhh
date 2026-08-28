import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

/** Devuelve la config SFTP. El password se enmascara ("***" si existe, "" si no). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const c = await prisma.generalConfig.findFirst({
    select: {
      sftpEnabled: true, sftpHost: true, sftpPort: true, sftpUser: true,
      sftpPassword: true, sftpIncomingPath: true, sftpProcessedPath: true,
      sftpErrorsPath: true,
      sftpPollIntervalMinutes: true, sftpStableSeconds: true,
    },
  })
  if (!c) return NextResponse.json({
    sftpEnabled: false, sftpHost: '', sftpPort: 22, sftpUser: '',
    sftpPasswordSet: false, sftpIncomingPath: '', sftpProcessedPath: '',
    sftpErrorsPath: '',
    sftpPollIntervalMinutes: 15, sftpStableSeconds: 30,
  })
  return NextResponse.json({
    sftpEnabled: c.sftpEnabled,
    sftpHost: c.sftpHost ?? '',
    sftpPort: c.sftpPort ?? 22,
    sftpUser: c.sftpUser ?? '',
    sftpPasswordSet: !!c.sftpPassword,
    sftpIncomingPath: c.sftpIncomingPath ?? '',
    sftpProcessedPath: c.sftpProcessedPath ?? '',
    sftpErrorsPath: c.sftpErrorsPath ?? '',
    sftpPollIntervalMinutes: c.sftpPollIntervalMinutes ?? 15,
    sftpStableSeconds: c.sftpStableSeconds ?? 30,
  })
}

/**
 * Actualiza la config. Si `sftpPassword` es null (o no viene), NO se cambia
 * la existente. Se actualiza únicamente si se manda una string no vacía.
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const {
    sftpEnabled, sftpHost, sftpPort, sftpUser, sftpPassword,
    sftpIncomingPath, sftpProcessedPath, sftpErrorsPath,
    sftpPollIntervalMinutes, sftpStableSeconds,
  } = body as Record<string, unknown>

  const port = Number(sftpPort)
  const interval = Number(sftpPollIntervalMinutes)
  const stable = Number(sftpStableSeconds)

  const data: Record<string, unknown> = {
    sftpEnabled: !!sftpEnabled,
    sftpHost: typeof sftpHost === 'string' ? sftpHost.trim() || null : null,
    sftpPort: Number.isFinite(port) && port > 0 ? port : 22,
    sftpUser: typeof sftpUser === 'string' ? sftpUser.trim() || null : null,
    sftpIncomingPath: typeof sftpIncomingPath === 'string' ? sftpIncomingPath.trim() || null : null,
    sftpProcessedPath: typeof sftpProcessedPath === 'string' ? sftpProcessedPath.trim() || null : null,
    sftpErrorsPath: typeof sftpErrorsPath === 'string' ? sftpErrorsPath.trim() || null : null,
    sftpPollIntervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 15,
    sftpStableSeconds: Number.isFinite(stable) && stable >= 0 ? stable : 30,
  }
  // Solo tocamos password si viene una string no vacía.
  if (typeof sftpPassword === 'string' && sftpPassword.length > 0) {
    data.sftpPassword = sftpPassword
  }

  const existing = await prisma.generalConfig.findFirst({ select: { id: true } })
  if (existing) {
    await prisma.generalConfig.update({ where: { id: existing.id }, data })
  } else {
    await prisma.generalConfig.create({ data: data as any })
  }
  await logAction(user.userId, 'ACTUALIZAR_CONFIG_SFTP', 'GeneralConfig', `enabled=${!!sftpEnabled}`)
  return NextResponse.json({ ok: true })
}
