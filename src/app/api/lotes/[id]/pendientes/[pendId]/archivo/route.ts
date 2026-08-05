import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { readFile } from 'fs/promises'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; pendId: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, pendId } = await params
  const pendiente = await prisma.loteArchivoPendiente.findUnique({ where: { id: Number(pendId) } })
  if (!pendiente || pendiente.loteId !== Number(id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  try {
    const buffer = await readFile(pendiente.filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pendiente.nombreArchivo}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }
}
