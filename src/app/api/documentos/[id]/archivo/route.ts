import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getAditusFile } from '@/lib/aditus'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: Number(id) } })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (user.role === 'EMPLOYEE' && doc.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  if (user.role === 'ADMIN') {
    const scope = await getScopedEmployeeIds(user.userId)
    if (scope && !scope.has(doc.employeeId)) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
  }

  if (!doc.aditusId) {
    return NextResponse.json({ error: 'Documento sin archivo en Aditus' }, { status: 404 })
  }

  try {
    const file = await getAditusFile(doc.aditusId, { download: true })
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        'Content-Type': file.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.nombreArchivo}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible en Aditus' }, { status: 404 })
  }
}
