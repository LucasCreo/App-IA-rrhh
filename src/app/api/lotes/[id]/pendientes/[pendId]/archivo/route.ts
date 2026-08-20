import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getAditusFile } from '@/lib/aditus'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; pendId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, pendId } = await params
  const pendiente = await prisma.loteArchivoPendiente.findUnique({ where: { id: Number(pendId) } })
  if (!pendiente || pendiente.loteId !== Number(id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  if (!pendiente.aditusId) {
    return NextResponse.json({ error: 'Pendiente sin archivo en Aditus' }, { status: 404 })
  }
  try {
    const file = await getAditusFile(pendiente.aditusId, { download: true })
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        'Content-Type': file.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${pendiente.nombreArchivo}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible en Aditus' }, { status: 404 })
  }
}
