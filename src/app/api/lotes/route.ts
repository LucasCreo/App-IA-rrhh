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
import { detectarLegajoDesdeFilename } from '@/lib/recibosDetect'

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
      pendientes: { select: { id: true } },
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
        pendientes: l.pendientes.length,
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

  const lote = await prisma.lote.create({
    data: {
      nombre,
      descripcion,
      periodo,
      creadoPorId: user.userId,
      ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
    },
  })

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  // Cargar patrones de filename + empleados scopeados para detección server-side
  const config = await prisma.generalConfig.findFirst({ select: { reciboFilenamePatterns: true } })
  let patterns: string[] = []
  try {
    if (config?.reciboFilenamePatterns) {
      const parsed = JSON.parse(config.reciboFilenamePatterns)
      if (Array.isArray(parsed)) patterns = parsed.filter(x => typeof x === 'string')
    }
  } catch { /* patrones inválidos */ }

  const scope = await getScopedEmployeeIds(user.userId)
  const empleadosActivos = await prisma.employee.findMany({
    where: { estado: 'ACTIVO', ...(scope ? { id: { in: [...scope] } } : {}) },
    select: { id: true, legajo: true },
  })
  const legajoSet = new Set(empleadosActivos.map(e => e.legajo))
  const empByLegajo = new Map(empleadosActivos.map(e => [e.legajo, e.id]))
  const empleadosConDoc = new Set<number>()

  let uploaded = 0
  let asignados = 0
  const errors: string[] = []
  let i = 0

  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File
    i++
    if (!file) continue

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

    // Strip cualquier prefijo de carpeta que el navegador haya adjuntado
    const nombreArchivoLimpio = file.name.replace(/^.*[\\/]/, '')

    // Intentar detectar legajo por filename (patrones + fallback genérico)
    const legajoDetectado = detectarLegajoDesdeFilename(nombreArchivoLimpio, legajoSet, patterns)
    const empId = legajoDetectado ? empByLegajo.get(legajoDetectado) : undefined

    if (empId && !empleadosConDoc.has(empId)) {
      // Auto-asignar: crear Document directamente
      await prisma.$transaction(async tx => {
        await tx.document.create({
          data: {
            nombreArchivo: nombreArchivoLimpio,
            filePath,
            periodo,
            employeeId: empId,
            cargadoPorId: user.userId,
            estado: 'BORRADOR',
            loteId: lote.id,
            ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
          },
        })
        await tx.loteEmpleado.upsert({
          where: { loteId_employeeId: { loteId: lote.id, employeeId: empId } },
          create: { loteId: lote.id, employeeId: empId },
          update: {},
        })
      })
      empleadosConDoc.add(empId)
      asignados++
      uploaded++
    } else {
      // Sin match o duplicado en este batch: queda como pendiente
      await prisma.loteArchivoPendiente.create({
        data: {
          loteId: lote.id,
          filePath,
          nombreArchivo: nombreArchivoLimpio,
          legajoDetectado: legajoDetectado ?? null,
        },
      })
      uploaded++
    }
  }

  await logAction(user.userId, 'CREAR_LOTE', 'Lote', `${nombre} — ${uploaded} archivo(s), ${asignados} auto-asignado(s)`)
  return NextResponse.json({ loteId: lote.id, uploaded, asignados, errors }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
