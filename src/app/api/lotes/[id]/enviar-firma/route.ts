import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { sendToSign } from '@/lib/signature'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const docs = await prisma.document.findMany({
    where: { loteId: Number(id), estado: { in: ['BORRADOR', 'ERROR'] } },
  })

  let sent = 0
  const errors: string[] = []

  for (const doc of docs) {
    try {
      const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
      await prisma.document.update({
        where: { id: doc.id },
        data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
      })
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      await prisma.document.update({ where: { id: doc.id }, data: { estado: 'ERROR' } })
      errors.push(`Doc ${doc.id}: ${msg}`)
    }
  }

  await logAction(user.userId, 'ENVIAR_FIRMA_LOTE', 'Lote', `ID ${id}: ${sent} enviados`)
  return NextResponse.json({ sent, errors })
}
