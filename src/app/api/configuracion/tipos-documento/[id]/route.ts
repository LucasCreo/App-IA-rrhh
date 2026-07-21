import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const existing = await prisma.tipoDocumento.findUnique({ where: { id: Number(id) } })
  if (existing?.protegido) return NextResponse.json({ error: 'Este tipo de documento es inmutable' }, { status: 403 })

  const { nombre, descripcion, accion, campos, tienePeriodo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const ACCIONES = ['FIRMA', 'LECTURA', 'NINGUNA']
  const nuevaAccion = ACCIONES.includes(accion) ? accion : undefined

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
    const tipo = await prisma.tipoDocumento.update({
      where: { id: Number(id) },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        accion: nuevaAccion,
        campos: campos !== undefined ? (campos ? JSON.stringify(campos) : null) : undefined,
        tienePeriodo: tienePeriodo !== undefined ? tienePeriodo !== false : undefined,
      },
    })
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
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
    }
    throw e
  }
}
