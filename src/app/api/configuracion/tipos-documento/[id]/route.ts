import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'
import { invalidateReciboTipoCache } from '@/lib/tiposDocumento'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const existing = await prisma.tipoDocumento.findUnique({ where: { id: Number(id) } })
  if (!existing) return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })

  const body = await req.json()
  const {
    nombre, descripcion, accion, metodoFirma, campos, tienePeriodo,
    firmaProveedorNombre, firmaApiKey, firmaApiSecret, firmaApiSecretClear,
    firmaEndpoint, firmaBody, firmaHeaders,
  } = body

  // Helpers
  const jsonOK = (v: unknown): boolean => {
    if (typeof v !== 'string') return true
    const t = v.trim()
    if (!t) return true
    try { JSON.parse(t); return true } catch { return false }
  }
  const normStr = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const t = v.trim()
    return t || null
  }
  if (!jsonOK(firmaBody))    return NextResponse.json({ error: 'firmaBody debe ser JSON válido' }, { status: 400 })
  if (!jsonOK(firmaHeaders)) return NextResponse.json({ error: 'firmaHeaders debe ser JSON válido' }, { status: 400 })

  // Fields de proveedor: sólo se guardan si metodoFirma será PROVEEDOR; si no, se limpian.
  // apiSecret sólo se actualiza si viene una string no vacía (para no borrar el existente).
  const buildFirmaFields = (metFirma: string) => {
    if (metFirma !== 'PROVEEDOR') {
      return {
        firmaProveedorNombre: null as string | null,
        firmaApiKey:          null as string | null,
        firmaApiSecret:       null as string | null,
        firmaEndpoint:        null as string | null,
        firmaBody:            null as string | null,
        firmaHeaders:         null as string | null,
      }
    }
    const data: Record<string, unknown> = {
      firmaProveedorNombre: normStr(firmaProveedorNombre),
      firmaApiKey:          normStr(firmaApiKey),
      firmaEndpoint:        normStr(firmaEndpoint),
      firmaBody:            normStr(firmaBody),
      firmaHeaders:         normStr(firmaHeaders),
    }
    if (firmaApiSecretClear === true) {
      data.firmaApiSecret = null
    } else if (typeof firmaApiSecret === 'string' && firmaApiSecret.length > 0) {
      data.firmaApiSecret = firmaApiSecret
    }
    return data
  }

  // En tipos protegidos (ej: "Recibo de Sueldo") sólo se pueden editar los campos de firma.
  if (existing.protegido) {
    const METODOS_FIRMA = ['CONTRASENA', 'PROVEEDOR']
    if (existing.accion !== 'FIRMA' || !METODOS_FIRMA.includes(metodoFirma)) {
      return NextResponse.json({ error: 'Este tipo de documento es inmutable' }, { status: 403 })
    }
    const tipo = await prisma.tipoDocumento.update({
      where: { id: Number(id) },
      data: { metodoFirma, ...buildFirmaFields(metodoFirma) },
    })
    invalidateReciboTipoCache()
    return NextResponse.json({ ...tipo, campos: tipo.campos ? JSON.parse(tipo.campos) : null })
  }

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const ACCIONES = ['FIRMA', 'LECTURA', 'NINGUNA']
  const METODOS_FIRMA = ['CONTRASENA', 'PROVEEDOR']
  const nuevaAccion = ACCIONES.includes(accion) ? accion : undefined
  const accionEfectiva = nuevaAccion ?? existing?.accion
  const nuevoMetodoFirma = accionEfectiva === 'FIRMA' && METODOS_FIRMA.includes(metodoFirma)
    ? metodoFirma
    : (accionEfectiva === 'FIRMA' ? undefined : 'CONTRASENA')

  // Bloquear cambio de acción si ya hay documentos usando este tipo
  if (nuevaAccion && existing && nuevaAccion !== existing.accion) {
    const docsCount = await prisma.document.count({ where: { tipoDocumentoId: Number(id) } })
    if (docsCount > 0) {
      return NextResponse.json({
        error: `No se puede cambiar la acción: hay ${docsCount} documento(s) cargado(s) con este tipo. Eliminá o migrá esos documentos antes de cambiar la acción.`,
        code: 'TIPO_ACCION_EN_USO',
      }, { status: 409 })
    }
  }

  try {
    const metFirmaFinal = nuevoMetodoFirma ?? existing.metodoFirma
    const tipo = await prisma.tipoDocumento.update({
      where: { id: Number(id) },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        accion: nuevaAccion,
        metodoFirma: nuevoMetodoFirma,
        campos: campos !== undefined ? (campos ? JSON.stringify(campos) : null) : undefined,
        tienePeriodo: tienePeriodo !== undefined ? tienePeriodo !== false : undefined,
        ...buildFirmaFields(metFirmaFinal),
      },
    })
    invalidateReciboTipoCache()
    return NextResponse.json({ ...tipo, campos: tipo.campos ? JSON.parse(tipo.campos) : null })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
      if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un tipo de documento con ese nombre' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const existing = await prisma.tipoDocumento.findUnique({ where: { id: Number(id) } })
  if (existing?.protegido) return NextResponse.json({ error: 'Este tipo de documento es inmutable' }, { status: 403 })

  try {
    await prisma.$transaction(async tx => {
      await tx.document.updateMany({ where: { tipoDocumentoId: Number(id) }, data: { tipoDocumentoId: null } })
      await tx.tipoDocumento.delete({ where: { id: Number(id) } })
    })
    invalidateReciboTipoCache()
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
    }
    throw e
  }
}
