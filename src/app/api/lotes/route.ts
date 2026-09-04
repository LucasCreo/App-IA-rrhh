import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { getReciboTipoId } from '@/lib/tiposDocumento'
import { uploadAditusFile, deleteAditusFile } from '@/lib/aditus'
import { reciboProps, reciboPendienteProps } from '@/lib/aditusRecibos'
import { actualizarProgresoLote } from '@/lib/loteProgress'
import {
  runValidators,
  pdfIntegridadValidator,
  nomencladorValidator,
  legajoExistenteValidator,
  type EmpleadoMin,
} from '@/lib/validators'

export async function GET(req: NextRequest) {
  try {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const periodo = searchParams.get('periodo')?.trim() ?? ''
  const sortByRaw = searchParams.get('sortBy') ?? 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  const SORT_ALLOWED: Record<string, 'nombre' | 'periodo' | 'createdAt'> = {
    nombre: 'nombre', periodo: 'periodo', createdAt: 'createdAt',
  }
  const sortBy = SORT_ALLOWED[sortByRaw] ?? 'createdAt'
  const pageParam = searchParams.get('page')
  const paged = pageParam !== null
  const page = Math.max(1, Number(pageParam ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20) || 20))

  const scope = await getScopedEmployeeIds(user.userId)
  const AND: any[] = []
  if (scope) {
    // El admin ve un lote si algún empleado asignado está en su scope O si el lote lo creó él mismo
    // (así puede ver un lote recién creado aunque todavía no tenga asignaciones dentro de su rama).
    AND.push({
      OR: [
        { creadoPorId: user.userId },
        { empleados: { some: { employeeId: { in: [...scope] } } } },
      ],
    })
  }
  if (q) AND.push({ OR: [{ nombre: { contains: q } }, { descripcion: { contains: q } }] })
  if (periodo) AND.push({ periodo: { contains: periodo } })
  const where = AND.length > 0 ? { AND } : {}

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
      orderBy: { [sortBy]: sortOrder },
      ...(paged ? { skip: (page - 1) * limit, take: limit } : {}),
    }),
  ])

  const items = lotes.map(l => {
    // Si el admin creó el lote, ve todos los empleados/docs (aunque estén fuera de su scope)
    const aplicaScope = scope && l.creadoPorId !== user.userId
    const empleadosIds = aplicaScope
      ? l.empleados.filter(e => scope!.has(e.employeeId)).map(e => e.employeeId)
      : l.empleados.map(e => e.employeeId)
    const docs = l.documentos.filter(d => !aplicaScope || scope!.has(d.employeeId))
    const empleadosConDoc = new Set(docs.map(d => d.employeeId))
    return {
      id: l.id,
      nombre: l.nombre,
      descripcion: l.descripcion ?? null,
      periodo: l.periodo,
      createdAt: l.createdAt,
      tipoDocumento: l.tipoDocumento,
      estado: l.estado,
      progreso: l.progreso,
      origen: l.origen,
      mes: l.mes,
      anio: l.anio,
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

  // Estado inicial provisorio; se recalcula al final según pendientes.
  const lote = await prisma.lote.create({
    data: {
      nombre,
      descripcion,
      periodo,
      creadoPorId: user.userId,
      origen: 'MANUAL',
      estado: 'LISTO',
      progreso: 100,
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

  const VALIDATORS = [pdfIntegridadValidator, nomencladorValidator, legajoExistenteValidator]

  let uploaded = 0
  let asignados = 0
  const errors: string[] = []
  let i = 0

  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File
    i++
    if (!file) continue

    const buffer = Buffer.from(await file.arrayBuffer())
    // Strip cualquier prefijo de carpeta que el navegador haya adjuntado
    const nombreArchivoLimpio = file.name.replace(/^.*[\\/]/, '')

    const validacion = await runValidators(VALIDATORS, {
      buffer,
      fileName: nombreArchivoLimpio,
      patterns,
      legajosValidos: legajoSet,
      empByLegajo,
    })

    // Errores fatales (PDF inválido / tamaño): no subimos a Aditus, se descarta.
    const fatal = validacion.errors.find(e => e.code === 'PDF_INVALIDO' || e.code === 'PDF_TAMANIO_EXCEDIDO')
    if (fatal) {
      errors.push(fatal.message)
      continue
    }

    const emp = validacion.metadata.empleado as EmpleadoMin | undefined
    const legajoFinal = typeof validacion.metadata.legajo === 'string' ? validacion.metadata.legajo : null
    const puedeAsignar = validacion.pass && emp && !empleadosConDoc.has(emp.id)

    let aditusId: string
    try {
      if (puedeAsignar && emp) {
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

    if (puedeAsignar && emp) {
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
        // Serializamos los motivos (errores + warnings) para que el admin
        // vea por qué el archivo quedó pendiente.
        const motivosArr = [...validacion.errors, ...validacion.warnings]
        // Duplicado también es "motivo" — si emp existe pero ya tenía doc en este lote.
        if (validacion.pass && emp && empleadosConDoc.has(emp.id)) {
          motivosArr.push({
            code: 'DUPLICADO_EN_LOTE',
            message: `El legajo ${emp.legajo} ya tiene un archivo asignado en este lote`,
            validator: 'lote',
          })
        }
        await prisma.loteArchivoPendiente.create({
          data: {
            loteId: lote.id,
            aditusId,
            nombreArchivo: nombreArchivoLimpio,
            legajoDetectado: legajoFinal ?? null,
            motivos: motivosArr.length > 0 ? JSON.stringify(motivosArr) : null,
          },
        })
        uploaded++
      } catch (e) {
        try { await deleteAditusFile(aditusId) } catch { /* rollback best-effort */ }
        errors.push(`${nombreArchivoLimpio}: ${e instanceof Error ? e.message : 'error creando pendiente'}`)
      }
    }
  }

  await actualizarProgresoLote(lote.id).catch(() => { /* best-effort */ })
  await logAction(user.userId, 'CREAR_LOTE', 'Lote', `${nombre} — ${uploaded} archivo(s), ${asignados} auto-asignado(s)`)
  return NextResponse.json({ loteId: lote.id, uploaded, asignados, errors }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
