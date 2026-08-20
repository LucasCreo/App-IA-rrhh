import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { validateFile } from '@/lib/fileValidation'
import { uploadAditusFile, getAditusFile } from '@/lib/aditus'
import { solicitudProps, encodeArchivoRef, parseArchivoRef, displayNameFromRef } from '@/lib/aditusSolicitudes'

const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!user.employeeId) return NextResponse.json({ error: 'Sin empleado asociado' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Falta archivo' }, { status: 400 })

  const tipoIdRaw = formData.get('tipoId') as string | null
  const tipoId = tipoIdRaw ? Number(tipoIdRaw) : null

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
  const check = validateFile(buffer, 'pdf-or-image')
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const [empleado, tipo] = await Promise.all([
    prisma.employee.findUnique({ where: { id: user.employeeId }, select: { legajo: true, cuil: true } }),
    tipoId ? prisma.tipoSolicitud.findUnique({ where: { id: tipoId }, select: { nombre: true } }) : Promise.resolve(null),
  ])
  if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

  try {
    const aditusId = await uploadAditusFile({
      content: buffer,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      properties: solicitudProps({ empleado, tipoNombre: tipo?.nombre ?? null, fileName: file.name }),
    })
    return NextResponse.json({ fileName: encodeArchivoRef(aditusId, file.name) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ref = new URL(req.url).searchParams.get('file')
  if (!ref) return NextResponse.json({ error: 'Inválido' }, { status: 400 })

  const { aditusId, nombre } = parseArchivoRef(ref)
  if (!aditusId) return NextResponse.json({ error: 'Ref inválida' }, { status: 400 })

  try {
    const f = await getAditusFile(aditusId, { download: true })
    return new NextResponse(new Uint8Array(f.content), {
      headers: {
        'Content-Type': f.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${displayNameFromRef(nombre) || 'archivo'}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }
}
