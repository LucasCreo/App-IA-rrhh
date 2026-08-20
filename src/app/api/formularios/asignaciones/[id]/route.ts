import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { deleteAditusFile } from '@/lib/aditus'
import { parseArchivoRef } from '@/lib/aditusSolicitudes'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const asignacionId = Number(id)

  // Recolectar aditusIds de campos tipo archivo antes de borrar
  const asignacion = await prisma.asignacionFormulario.findUnique({
    where: { id: asignacionId },
    include: {
      plantilla: { include: { campos: { select: { nombre: true, tipo: true } } } },
      respuestas: { select: { datos: true } },
    },
  })
  const camposArchivo = asignacion?.plantilla.campos.filter(c => c.tipo === 'archivo').map(c => c.nombre) ?? []
  const aditusIds: string[] = []
  for (const r of asignacion?.respuestas ?? []) {
    try {
      const datos = JSON.parse(r.datos) as Record<string, string>
      for (const nombre of camposArchivo) {
        const ref = datos[nombre]
        if (typeof ref === 'string' && ref) {
          const { aditusId } = parseArchivoRef(ref)
          if (aditusId) aditusIds.push(aditusId)
        }
      }
    } catch { /* datos no parseables — ignorar */ }
  }

  await prisma.respuestaFormulario.deleteMany({ where: { asignacionId } })
  await prisma.asignacionFormulario.delete({ where: { id: asignacionId } })

  for (const aid of aditusIds) {
    try { await deleteAditusFile(aid) } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { nombre, plantillaId, fechaLimite, datosAdmin } = await req.json()

  const current = await prisma.asignacionFormulario.findUnique({ where: { id: Number(id) } })
  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const plantillaChanged = plantillaId && Number(plantillaId) !== current.plantillaId

  if (plantillaChanged) {
    const enviadas = await prisma.respuestaFormulario.count({
      where: { asignacionId: Number(id), estado: 'ENVIADO' },
    })
    if (enviadas > 0) {
      return NextResponse.json({
        error: `No se puede cambiar la plantilla: hay ${enviadas} respuesta${enviadas !== 1 ? 's' : ''} ya enviada${enviadas !== 1 ? 's' : ''}. Creá una nueva asignación.`,
      }, { status: 409 })
    }
  }

  await prisma.asignacionFormulario.update({
    where: { id: Number(id) },
    data: {
      nombre: nombre.trim(),
      plantillaId: Number(plantillaId),
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      datosAdmin: JSON.stringify(datosAdmin ?? {}),
    },
  })

  if (plantillaChanged) {
    // Recolectar aditusIds de archivos que van a quedar huérfanos al resetear datos
    const respuestas = await prisma.respuestaFormulario.findMany({
      where: { asignacionId: Number(id) },
      select: { datos: true },
    })
    const camposArchivoAnt = await prisma.campoFormulario.findMany({
      where: { plantillaId: current.plantillaId, tipo: 'archivo' },
      select: { nombre: true },
    })
    const nombresArchivo = new Set(camposArchivoAnt.map(c => c.nombre))
    const aditusIds: string[] = []
    for (const r of respuestas) {
      try {
        const datos = JSON.parse(r.datos) as Record<string, string>
        for (const [k, v] of Object.entries(datos)) {
          if (nombresArchivo.has(k) && typeof v === 'string' && v) {
            const { aditusId } = parseArchivoRef(v)
            if (aditusId) aditusIds.push(aditusId)
          }
        }
      } catch { /* ignorar */ }
    }

    // Todas las respuestas eran PENDIENTES (o borrador sin enviar) — resetear datos por si había parciales
    await prisma.respuestaFormulario.updateMany({
      where: { asignacionId: Number(id) },
      data: { estado: 'PENDIENTE', datos: '{}' },
    })

    for (const aid of aditusIds) {
      try { await deleteAditusFile(aid) } catch { /* best-effort */ }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const asignacion = await prisma.asignacionFormulario.findUnique({
    where: { id: Number(id) },
    include: {
      plantilla: { include: { campos: { orderBy: { orden: 'asc' } } } },
      respuestas: {
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
        },
        orderBy: { employee: { apellido: 'asc' } },
      },
    },
  })
  if (!asignacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({
    ...asignacion,
    datosAdmin: (() => { try { return JSON.parse(asignacion.datosAdmin) } catch { return {} } })(),
    respuestas: asignacion.respuestas.map(r => ({
      ...r,
      datos: (() => { try { return JSON.parse(r.datos) } catch { return {} } })(),
    })),
  })
}
