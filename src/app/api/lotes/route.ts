import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getReciboTipoId } from '@/lib/tiposDocumento'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'

export async function GET() {
  try {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const scope = await getScopedEmployeeIds(user.userId)
  const lotes = await prisma.lote.findMany({
    where: scope ? { empleados: { some: { employeeId: { in: [...scope] } } } } : {},
    include: {
      tipoDocumento: { select: { id: true, nombre: true } },
      documentos: { select: { estado: true, employeeId: true } },
      empleados: { select: { employeeId: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(lotes.map(l => {
    const empleadosIds = scope
      ? l.empleados.filter(e => scope.has(e.employeeId)).map(e => e.employeeId)
      : l.empleados.map(e => e.employeeId)
    const docs = l.documentos.filter(d => !scope || scope.has(d.employeeId))
    const empleadosConDoc = new Set(docs.map(d => d.employeeId))
    return {
      id: l.id,
      nombre: l.nombre,
      descripcion: l.descripcion ?? null,
      periodo: l.periodo,
      createdAt: l.createdAt,
      tipoDocumento: l.tipoDocumento,
      stats: {
        total: empleadosIds.length,
        firmados: docs.filter(d => d.estado === 'FIRMADO').length,
        enFirma: docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
        borradores: docs.filter(d => d.estado === 'BORRADOR').length,
        errores: docs.filter(d => d.estado === 'ERROR').length,
        rechazados: docs.filter(d => d.estado === 'RECHAZADO').length,
        sinRecibo: empleadosIds.filter(id => !empleadosConDoc.has(id)).length,
      },
    }
  }))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const nombre = (formData.get('nombre') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim() || null
  const periodo = formData.get('periodo') as string
  const tipoDocumentoIdRaw = formData.get('tipoDocumentoId')
  let tipoDocumentoId = tipoDocumentoIdRaw ? Number(tipoDocumentoIdRaw) : undefined
  if (!tipoDocumentoId) {
    const cached = await getReciboTipoId()
    if (cached) tipoDocumentoId = cached
  }

  if (!nombre || !periodo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const employeeIdsRaw = formData.get('employeeIds') as string | null
  const employeeIds: number[] = employeeIdsRaw
    ? (JSON.parse(employeeIdsRaw) as unknown[]).map(Number).filter(n => Number.isInteger(n))
    : []

  const lote = await prisma.lote.create({
    data: {
      nombre,
      descripcion,
      periodo,
      creadoPorId: user.userId,
      ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
      ...(employeeIds.length > 0 ? {
        empleados: { create: employeeIds.map(employeeId => ({ employeeId })) },
      } : {}),
    },
  })

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const uploaded: number[] = []
  const errors: string[] = []
  const empleadosYaCargados = new Set<number>()
  let i = 0

  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File
    const employeeId = Number(formData.get(`employeeId_${i}`))
    i++

    if (!file || !employeeId) {
      errors.push(`Archivo ${i}: datos incompletos`)
      continue
    }

    if (empleadosYaCargados.has(employeeId)) {
      errors.push(`${file.name}: el empleado ya tiene un recibo en este lote (se descartó el duplicado)`)
      continue
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.length > MAX_PDF_SIZE) {
      errors.push(`${file.name}: supera el límite de 10 MB`)
      continue
    }

    if (!isPdfBuffer(buffer)) {
      errors.push(`${file.name}: no es un PDF válido`)
      continue
    }

    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    const doc = await prisma.document.create({
      data: {
        nombreArchivo: file.name,
        filePath,
        periodo,
        employeeId,
        cargadoPorId: user.userId,
        estado: 'BORRADOR',
        loteId: lote.id,
        ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
      },
    })
    uploaded.push(doc.id)
    empleadosYaCargados.add(employeeId)

    await prisma.loteEmpleado.upsert({
      where: { loteId_employeeId: { loteId: lote.id, employeeId } },
      create: { loteId: lote.id, employeeId },
      update: {},
    })
  }

  await logAction(user.userId, 'CREAR_LOTE', 'Lote', `${nombre} — ${uploaded.length} docs`)
  return NextResponse.json({ loteId: lote.id, uploaded: uploaded.length, errors }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
