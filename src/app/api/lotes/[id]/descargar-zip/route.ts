import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getAditusFile } from '@/lib/aditus'
import JSZip from 'jszip'

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const loteId = Number(id)
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    select: { id: true, nombre: true, periodo: true },
  })
  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

  const docs = await prisma.document.findMany({
    where: { loteId, aditusId: { not: null } },
    select: {
      aditusId: true,
      nombreArchivo: true,
      employee: { select: { legajo: true, apellido: true, nombre: true } },
    },
  })

  const zip = new JSZip()
  let incluidos = 0
  for (const d of docs) {
    if (!d.aditusId) continue
    try {
      const file = await getAditusFile(d.aditusId, { download: true })
      const emp = d.employee
      const base = `${emp.legajo}_${slug(emp.apellido)}_${slug(emp.nombre)}.pdf`
      zip.file(base, file.content)
      incluidos++
    } catch {
      // Ignorar archivos faltantes en Aditus
    }
  }

  if (incluidos === 0) {
    return NextResponse.json({ error: 'No hay archivos disponibles para descargar' }, { status: 404 })
  }

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const filename = `${slug(lote.nombre)}_${lote.periodo}.zip`
  return new NextResponse(new Uint8Array(content), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
