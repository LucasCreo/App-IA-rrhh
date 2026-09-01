import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { validateFile } from '@/lib/fileValidation'
import { uploadAditusFile, getAditusFile } from '@/lib/aditus'
import { encodeArchivoRef, parseArchivoRef, displayNameFromRef } from '@/lib/aditusSolicitudes'
import { marcarSubidoPor, fueSubidoRecientementePor } from '@/lib/archivosSubidos'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'

const MAX_SIZE = 10 * 1024 * 1024
const LEGACY_UPLOADS_DIR = join(process.cwd(), 'uploads', 'campos')

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Falta archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  const check = validateFile(buffer, 'pdf-or-image')
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  try {
    const aditusId = await uploadAditusFile({
      content: buffer,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      properties: {
        objectTitle: file.name,
        tipoDocumento: 'Campo personalizado',
      },
    })
    marcarSubidoPor(aditusId, user.userId)
    return NextResponse.json({ fileName: encodeArchivoRef(aditusId, file.name), nombre: file.name })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ref = new URL(req.url).searchParams.get('file')
  if (!ref) return NextResponse.json({ error: 'Inválido' }, { status: 400 })

  // Refs nuevos vienen en formato "aditusId||nombre".
  // Si no matchea, es un filename legacy en disco.
  const { aditusId, nombre } = parseArchivoRef(ref)
  const esRefAditus = ref.includes('||')

  if (esRefAditus && aditusId) {
    // Autorización: dueño (empleado con ese valor), admin con permiso, o quien acaba de subirlo
    const owner = await prisma.valorCampoEmpleado.findFirst({
      where: { valor: { contains: aditusId } },
      select: { employeeId: true },
    })
    if (!owner && !fueSubidoRecientementePor(aditusId, user.userId)) {
      // Solo admins con permiso pueden ver refs sin owner reciente
      if (user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
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

  // Legacy: archivo local en disco (por compat con registros viejos)
  if (ref.includes('..') || /[/\\]/.test(ref)) {
    return NextResponse.json({ error: 'Inválido' }, { status: 400 })
  }
  try {
    const buffer = await readFile(join(LEGACY_UPLOADS_DIR, ref))
    const displayName = ref.replace(/^\d+-/, '')
    const ext = extname(displayName).toLowerCase()
    const contentType = ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : 'application/octet-stream'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${displayName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
}
