import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import { uploadAditusFile, deleteAditusFile } from '@/lib/aditus'
import { reciboProps } from '@/lib/aditusRecibos'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const estado = searchParams.get('estado')
  const periodo = searchParams.get('periodo') ?? undefined
  const reciboParam = searchParams.get('recibo')
  const sinLote = searchParams.get('sinLote') === 'true'
  const loteIdParam = searchParams.get('loteId')
  const tipoDocumentoId = searchParams.get('tipoDocumentoId') ? Number(searchParams.get('tipoDocumentoId')) : undefined
  const categoriaId = searchParams.get('categoriaId') ? Number(searchParams.get('categoriaId')) : undefined
  const q = searchParams.get('q')?.trim() ?? ''
  const conformidadParam = searchParams.get('conformidad')
  const conformidadFilter = conformidadParam === 'true' ? { firmaConforme: true }
    : conformidadParam === 'false' ? { firmaConforme: false }
    : {}
  const RECIBO_TIPO = 'Recibo de Sueldo'

  const VALID_ESTADOS = ['BORRADOR', 'ENVIADO_A_FIRMA', 'FIRMADO', 'RECHAZADO', 'ERROR']
  if (estado && !VALID_ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const effectiveEmployeeId = user.role === 'EMPLOYEE'
    ? user.employeeId
    : (employeeId ? Number(employeeId) : undefined)

  const reciboFilter = reciboParam === 'true'
    ? { tipoDocumento: { nombre: RECIBO_TIPO } }
    : reciboParam === 'false'
      ? { OR: [{ tipoDocumentoId: null }, { tipoDocumento: { nombre: { not: RECIBO_TIPO } } }] }
      : {}

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = user.role === 'EMPLOYEE' ? 1000 : 50

  const scope = user.role === 'ADMIN' ? await getScopedEmployeeIds(user.userId) : null

  // Si el admin está scopeado y pidió un employeeId puntual, verificar que esté dentro del scope
  if (scope && effectiveEmployeeId && !scope.has(effectiveEmployeeId)) {
    return NextResponse.json({ docs: [], total: 0, page: 1, pages: 0 })
  }

  const employeeIdFilter = effectiveEmployeeId
    ? { employeeId: effectiveEmployeeId }
    : scope
      ? { employeeId: { in: [...scope] } }
      : {}

  const where = {
    ...employeeIdFilter,
    ...(estado ? { estado } : {}),
    ...(user.role === 'EMPLOYEE' ? { estado: { in: ['ENVIADO_A_FIRMA', 'FIRMADO'] } } : {}),
    ...(periodo ? { periodo: { contains: periodo } } : {}),
    ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    ...(categoriaId ? { employee: { categoriaId } } : {}),
    ...(q ? {
      OR: [
        { nombreArchivo: { contains: q } },
        { employee: { legajo: { contains: q } } },
        { employee: { nombre: { contains: q } } },
        { employee: { apellido: { contains: q } } },
      ],
    } : {}),
    ...reciboFilter,
    ...(sinLote || loteIdParam === 'sinLote'
      ? { loteId: null }
      : loteIdParam && loteIdParam !== 'todos'
        ? { loteId: Number(loteIdParam) }
        : {}),
    ...conformidadFilter,
  }

  const [total, docs] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: {
        employee: { select: { nombre: true, apellido: true, legajo: true } },
        cargadoPor: { select: { email: true } },
        tipoDocumento: { select: { id: true, nombre: true, accion: true } },
        lote: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaCarga: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ docs, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const employeeId = Number(formData.get('employeeId'))

  const scopePost = await getScopedEmployeeIds(user.userId)
  if (scopePost && !scopePost.has(employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre ese empleado' }, { status: 403 })
  }
  const periodo = (formData.get('periodo') as string | null) || null
  const metadataRaw = formData.get('metadata') as string | null
  const tipoDocumentoIdRaw = formData.get('tipoDocumentoId')
  const tipoDocumentoId = tipoDocumentoIdRaw ? Number(tipoDocumentoIdRaw) : undefined

  if (!file || !employeeId) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (buffer.length > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  }

  if (!isPdfBuffer(buffer)) {
    return NextResponse.json({ error: 'El archivo no es un PDF válido' }, { status: 400 })
  }

  const empleado = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { legajo: true, nombre: true, apellido: true, cuil: true },
  })
  if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

  let aditusId: string
  try {
    aditusId = await uploadAditusFile({
      content: buffer,
      fileName: file.name,
      contentType: 'application/pdf',
      properties: reciboProps({ empleado, periodo }),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
  }

  let doc
  try {
    doc = await prisma.document.create({
      data: {
        nombreArchivo: file.name,
        aditusId,
        periodo,
        metadata: metadataRaw || null,
        employeeId,
        cargadoPorId: user.userId,
        estado: 'BORRADOR',
        ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
      },
      include: {
        employee: { select: { nombre: true, apellido: true, legajo: true } },
      },
    })
  } catch (e) {
    try { await deleteAditusFile(aditusId) } catch { /* rollback best-effort */ }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error creando documento' }, { status: 500 })
  }

  await logAction(user.userId, 'CARGAR', 'Documento', `${file.name} → ${doc.employee.legajo}`)
  return NextResponse.json(doc, { status: 201 })
}
