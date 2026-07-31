import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'
import { readFile } from 'fs/promises'
import JSZip from 'jszip'

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { ids } = await req.json().catch(() => ({ ids: [] }))
  const docIds: number[] = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : []
  if (docIds.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 400 })

  const scope = user.role === 'ADMIN' ? await getScopedEmployeeIds(user.userId) : null
  const employeeFilter = user.role === 'EMPLOYEE'
    ? { employeeId: user.employeeId! }
    : scope ? { employeeId: { in: [...scope] } } : {}

  const docs = await prisma.document.findMany({
    where: { id: { in: docIds }, ...employeeFilter, filePath: { not: '' } },
    select: {
      filePath: true,
      nombreArchivo: true,
      employee: { select: { legajo: true, apellido: true, nombre: true } },
    },
  })

  const zip = new JSZip()
  let incluidos = 0
  const usados = new Set<string>()
  for (const d of docs) {
    try {
      const buffer = await readFile(d.filePath)
      const emp = d.employee
      let base = `${emp.legajo}_${slug(emp.apellido)}_${slug(emp.nombre)}.pdf`
      let i = 2
      while (usados.has(base)) {
        base = `${emp.legajo}_${slug(emp.apellido)}_${slug(emp.nombre)}_${i}.pdf`
        i++
      }
      usados.add(base)
      zip.file(base, buffer)
      incluidos++
    } catch { /* faltante en disco */ }
  }

  if (incluidos === 0) {
    return NextResponse.json({ error: 'No hay archivos disponibles para descargar' }, { status: 404 })
  }

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const filename = `documentos_${new Date().toISOString().slice(0, 10)}.zip`
  return new NextResponse(new Uint8Array(content), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
