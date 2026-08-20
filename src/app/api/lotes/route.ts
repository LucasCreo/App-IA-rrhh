import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getReciboTipoId } from '@/lib/tiposDocumento'
import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import { detectarLegajoDesdeFilename } from '@/lib/recibosDetect'
import { uploadAditusFile, deleteAditusFile } from '@/lib/aditus'
import { reciboProps, reciboPendienteProps } from '@/lib/aditusRecibos'

export async function GET(req: NextRequest) {
  try {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const pageParam = searchParams.get('page')
  const paged = pageParam !== null
  const page = Math.max(1, Number(pageParam ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20) || 20))

  const scope = await getScopedEmployeeIds(user.userId)
  const where = {
    ...(scope ? { empleados: { some: { employeeId: { in: [...scope] } } } } : {}),
    ...(q ? { nombre: { contains: q } } : {}),
  }

  const [total, lotes] = await Promise.all([
    paged ? prisma.lote.count({ where }) : Promise.resolve(0),
    prisma.lote.findMany({
      where,
      include: {
        tipoDocumento: { select: { id: true, nombre: true } },
        documentos: { select: { estado: true, employeeId: true } },
        empleados: { select: { employeeId: true } },
        pendientes: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(paged ? { skip: (page - 1) * limit, take: limit } : {}),
    }),
  ])

  const items = lotes.map(l => {
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
  })

  if (paged) {
    return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  }
  return NextResponse.json(items)
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
    select: { id: true, legajo: true, nombre: true, apellido: true, cuil: true },
  })
  const legajoSet = new Set(empleadosActivos.map(e => e.legajo))
  const empByLegajo = new Map(empleadosActivos.map(e => [e.legajo, e]))
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

    // Strip cualquier prefijo de carpeta que el navegador haya adjuntado
    const nombreArchivoLimpio = file.name.replace(/^.*[\\/]/, '')

    // Intentar detectar legajo por filename (patrones + fallback genérico)
    const legajoDetectado = detectarLegajoDesdeFilename(nombreArchivoLimpio, legajoSet, patterns)
    const emp = legajoDetectado ? empByLegajo.get(legajoDetectado) : undefined

    let aditusId: string
    try {
      if (emp && !empleadosConDoc.has(emp.id)) {
        aditusId = await uploadAditusFile({
          content: buffer,
          fileName: nombreArchivoLimpio,
          contentType: 'application/pdf',
          properties: reciboProps({ empleado: emp, periodo, loteNombre: nombre }),
        })
      } else {
        aditusId = await uploadAditusFile({
          content: buffer,
          fileName: nombreArchivoLimpio,
          contentType: 'application/pdf',
          properties: reciboPendienteProps({ fileName: nombreArchivoLimpio, loteNombre: nombre }),
        })
      }
    } catch (e) {
      errors.push(`${nombreArchivoLimpio}: ${e instanceof Error ? e.message : 'error subiendo a Aditus'}`)
      continue
    }

    if (emp && !empleadosConDoc.has(emp.id)) {
      try {
        await prisma.$transaction(async tx => {
          await tx.document.create({
            data: {
              nombreArchivo: nombreArchivoLimpio,
              aditusId,
              periodo,
              employeeId: emp.id,
              cargadoPorId: user.userId,
              estado: 'BORRADOR',
              loteId: lote.id,
              ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
            },
          })
          await tx.loteEmpleado.upsert({
            where: { loteId_employeeId: { loteId: lote.id, employeeId: emp.id } },
            create: { loteId: lote.id, employeeId: emp.id },
            update: {},
          })
        })
        empleadosConDoc.add(emp.id)
        asignados++
        uploaded++
      } catch (e) {
        try { await deleteAditusFile(aditusId) } catch { /* rollback best-effort */ }
        errors.push(`${nombreArchivoLimpio}: ${e instanceof Error ? e.message : 'error creando registro'}`)
      }
    } else {
      try {
        await prisma.loteArchivoPendiente.create({
          data: {
            loteId: lote.id,
            aditusId,
            nombreArchivo: nombreArchivoLimpio,
            legajoDetectado: legajoDetectado ?? null,
          },
        })
        uploaded++
      } catch (e) {
        try { await deleteAditusFile(aditusId) } catch { /* rollback best-effort */ }
        errors.push(`${nombreArchivoLimpio}: ${e instanceof Error ? e.message : 'error creando pendiente'}`)
      }
    }
  }

  await logAction(user.userId, 'CREAR_LOTE', 'Lote', `${nombre} — ${uploaded} archivo(s), ${asignados} auto-asignado(s)`)
  return NextResponse.json({ loteId: lote.id, uploaded, asignados, errors }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
