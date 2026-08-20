import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getScopedEmployeeIds } from '@/lib/scope'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { deleteAditusFile } from '@/lib/aditus'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)
  const scope = await getScopedEmployeeIds(user.userId)

  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    include: {
      tipoDocumento: { select: { id: true, nombre: true, accion: true } },
      cargadoPor: { select: { email: true } },
      asignaciones: {
        include: {
          employee: {
            select: {
              id: true, nombre: true, apellido: true, legajo: true,
              categoria: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    },
  })
  if (!grupo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const asigns = scope ? grupo.asignaciones.filter(a => scope.has(a.employeeId)) : grupo.asignaciones
  return NextResponse.json({
    id: grupo.id,
    nombreArchivo: grupo.nombreArchivo,
    periodo: grupo.periodo,
    tipoDocumento: grupo.tipoDocumento,
    cargadoPor: grupo.cargadoPor,
    createdAt: grupo.createdAt,
    asignaciones: asigns,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)
  const body = await req.json().catch(() => ({}))

  const data: Record<string, unknown> = {}
  if (typeof body.nombreArchivo === 'string' && body.nombreArchivo.trim()) {
    data.nombreArchivo = body.nombreArchivo.trim()
  }
  if (body.periodo === null || typeof body.periodo === 'string') {
    data.periodo = body.periodo ? String(body.periodo).trim() || null : null
  }
  if (body.tipoDocumentoId !== undefined) {
    if (!Number.isInteger(body.tipoDocumentoId)) {
      return NextResponse.json({ error: 'El tipo de documento es requerido' }, { status: 400 })
    }
    data.tipoDocumentoId = body.tipoDocumentoId
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  // Si cambia el tipo, no permitir hacerlo si hay asignaciones fuera de BORRADOR
  if (data.tipoDocumentoId !== undefined) {
    const actual = await prisma.documentoGrupo.findUnique({
      where: { id: grupoId },
      select: { tipoDocumentoId: true },
    })
    if (actual && actual.tipoDocumentoId !== data.tipoDocumentoId) {
      const noBorrador = await prisma.documentoAsignacion.count({
        where: { grupoId, estado: { not: 'BORRADOR' } },
      })
      if (noBorrador > 0) {
        return NextResponse.json({
          error: `No se puede cambiar el tipo: hay ${noBorrador} asignación${noBorrador !== 1 ? 'es' : ''} enviada${noBorrador !== 1 ? 's' : ''} o firmada${noBorrador !== 1 ? 's' : ''}.`,
        }, { status: 409 })
      }
    }
  }

  try {
    const grupo = await prisma.documentoGrupo.update({ where: { id: grupoId }, data })
    await logAction(user.userId, 'EDITAR_DOCUMENTO_GRUPO', 'Documento', `Grupo ${grupoId}: ${grupo.nombreArchivo}`)
    return NextResponse.json({ ok: true, grupo })
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)
  const grupo = await prisma.documentoGrupo.findUnique({ where: { id: grupoId } })
  if (!grupo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.documentoGrupo.delete({ where: { id: grupoId } })
  if (grupo.aditusId) {
    try { await deleteAditusFile(grupo.aditusId) } catch { /* best-effort */ }
  }

  await logAction(user.userId, 'ELIMINAR_DOCUMENTO_GRUPO', 'Documento', `Grupo ${grupoId}: ${grupo.nombreArchivo}`)
  return NextResponse.json({ ok: true })
}

// Enviar a firma / notificar todas las asignaciones en borrador
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const grupoId = Number(id)
  const body = await req.json().catch(() => ({}))
  const asignacionIds: number[] | null = Array.isArray(body?.asignacionIds)
    ? body.asignacionIds.map(Number).filter((n: number) => Number.isInteger(n))
    : null

  const grupo = await prisma.documentoGrupo.findUnique({
    where: { id: grupoId },
    include: { tipoDocumento: { select: { nombre: true, accion: true } } },
  })
  if (!grupo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!grupo.tipoDocumento) {
    return NextResponse.json({ error: 'El documento no tiene tipo asignado. Editalo antes de enviar.' }, { status: 400 })
  }

  const res = await prisma.documentoAsignacion.updateMany({
    where: {
      grupoId,
      estado: 'BORRADOR',
      ...(asignacionIds && asignacionIds.length > 0 ? { id: { in: asignacionIds } } : {}),
    },
    data: { estado: 'ENVIADO_A_FIRMA' },
  })

  await logAction(user.userId, 'ENVIAR_FIRMA_DOCUMENTO', 'Documento', `Grupo ${grupoId}: ${res.count} asignaciones`)

  // Notificar por email
  const asigns = await prisma.documentoAsignacion.findMany({
    where: {
      grupoId,
      estado: 'ENVIADO_A_FIRMA',
      ...(asignacionIds && asignacionIds.length > 0 ? { id: { in: asignacionIds } } : {}),
    },
    include: { employee: { select: { nombre: true, email: true } } },
  })
  const accion = grupo.tipoDocumento.accion
  const requiereFirma = accion === 'FIRMA'
  const tipo = grupo.tipoDocumento.nombre
  Promise.all(asigns
    .filter(a => a.employee?.email)
    .map(a => sendMailFromTemplate('DOCUMENTO_A_FIRMA', {
      to: a.employee.email,
      vars: {
        nombre: a.employee.nombre,
        tipo,
        titulo: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
        bloquePeriodo: grupo.periodo ? ` (${grupo.periodo})` : '',
        bloqueFirma: requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
    }))
  ).catch(e => console.error('[email/doc-grupo] fallo:', e))

  return NextResponse.json({ sent: res.count })
}
