import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import SftpClient from 'ssh2-sftp-client'

/**
 * Prueba la conexión SFTP con los valores de la config (o los pasados en el
 * body si están, para probar antes de guardar). Devuelve el count de PDFs
 * en la ruta de incoming como confirmación.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const c = await prisma.generalConfig.findFirst()

  const host = (typeof body.sftpHost === 'string' && body.sftpHost.trim()) || c?.sftpHost
  const user_ = (typeof body.sftpUser === 'string' && body.sftpUser.trim()) || c?.sftpUser
  const password = typeof body.sftpPassword === 'string' && body.sftpPassword.length > 0
    ? body.sftpPassword
    : c?.sftpPassword
  const port = Number(body.sftpPort ?? c?.sftpPort ?? 22)
  const incomingPath = (typeof body.sftpIncomingPath === 'string' && body.sftpIncomingPath.trim()) || c?.sftpIncomingPath

  if (!host || !user_ || !password || !incomingPath) {
    return NextResponse.json({ ok: false, error: 'Faltan host / usuario / password / ruta' }, { status: 400 })
  }

  const client = new SftpClient()
  try {
    await client.connect({ host, port, username: user_, password, readyTimeout: 15_000 })
    const items = await client.list(incomingPath)
    const pdfs = items.filter(i => i.type === '-' && i.name.toLowerCase().endsWith('.pdf'))
    return NextResponse.json({ ok: true, totalItems: items.length, pdfsCount: pdfs.length })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error de conexión',
    }, { status: 200 })
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}
