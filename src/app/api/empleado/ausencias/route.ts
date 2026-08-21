import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { parseClientDate } from '@/lib/dates'
import { esTopDelOrganigrama } from '@/lib/scope'
import { validateFile, extForKind } from '@/lib/fileValidation'
import { uploadAditusFile } from '@/lib/aditus'
import { ausenciaProps, encodeArchivoRef } from '@/lib/aditusSolicitudes'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const anio = new Date().getFullYear()
  const [solicitudes, saldo] = await Promise.all([
    prisma.solicitudAusencia.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: { tipoAusencia: { select: { nombre: true, color: true } } },
    }),
    prisma.saldoVacaciones.findUnique({
      where: { employeeId_anio: { employeeId: user.employeeId, anio } },
    }),
  ])

  return NextResponse.json({ solicitudes, saldo })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const tipoAusenciaId = formData.get('tipoAusenciaId') as string
  const fechaInicio = formData.get('fechaInicio') as string
  const fechaFin = formData.get('fechaFin') as string
  const motivo = formData.get('motivo') as string | null
  const archivo = formData.get('archivo') as File | null

  if (!tipoAusenciaId || !fechaInicio || !fechaFin)
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

  const inicio = parseClientDate(fechaInicio)
  const fin = parseClientDate(fechaFin)
  if (fin < inicio) return NextResponse.json({ error: 'La fecha de fin debe ser posterior al inicio' }, { status: 400 })

  let dias = 0
  const cur = new Date(inicio)
  while (cur <= fin) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) dias++
    cur.setDate(cur.getDate() + 1)
  }

  let archivoUrl: string | null = null
  if (archivo && archivo.size > 0) {
    if (archivo.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
    const buffer = Buffer.from(await archivo.arrayBuffer())
    const check = validateFile(buffer, 'pdf-or-image')
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const [emp, tipoAus] = await Promise.all([
      prisma.employee.findUnique({ where: { id: user.employeeId }, select: { legajo: true, cuil: true } }),
      prisma.tipoAusencia.findUnique({ where: { id: Number(tipoAusenciaId) }, select: { nombre: true } }),
    ])
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

    const fileName = archivo.name || `ausencia.${extForKind(check.kind)}`
    try {
      const aditusId = await uploadAditusFile({
        content: buffer,
        fileName,
        contentType: archivo.type || 'application/octet-stream',
        properties: ausenciaProps({ empleado: emp, tipoAusenciaNombre: tipoAus?.nombre ?? null, fileName }),
      })
      archivoUrl = `/api/ausencias/archivo?file=${encodeURIComponent(encodeArchivoRef(aditusId, fileName))}`
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo a Aditus' }, { status: 500 })
    }
  }

  const autoAprobar = await esTopDelOrganigrama(user.employeeId)

  const solicitud = await prisma.solicitudAusencia.create({
    data: {
      employeeId: user.employeeId,
      tipoAusenciaId: Number(tipoAusenciaId),
      fechaInicio: inicio,
      fechaFin: fin,
      dias,
      motivo: motivo?.trim() || null,
      archivoUrl,
      estado: autoAprobar ? 'APROBADA' : 'PENDIENTE',
      comentarioAdmin: autoAprobar ? 'Auto-aprobada (top del organigrama)' : null,
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
      tipoAusencia: { select: { nombre: true, afectaSaldo: true } },
    },
  })

  if (autoAprobar) {
    // No creamos Evento: /api/eventos ya expone las ausencias aprobadas como
    // eventos virtuales, así que crear uno real duplicaría la entrada en el calendario.
    if (solicitud.tipoAusencia.afectaSaldo) {
      const anio = solicitud.fechaInicio.getFullYear()
      await prisma.saldoVacaciones.upsert({
        where: { employeeId_anio: { employeeId: user.employeeId, anio } },
        update: { diasUsados: { increment: solicitud.dias } },
        create: { employeeId: user.employeeId, anio, diasTotales: 14, diasUsados: solicitud.dias },
      })
    }
    return NextResponse.json(solicitud, { status: 201 })
  }

  // Notificar a admins con email
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', email: { not: '' } },
    select: { email: true },
  })
  const fmt = (d: Date) => d.toLocaleDateString('es-AR')
  const rango = `${fmt(inicio)} — ${fmt(fin)}`
  // Fire-and-forget: no bloqueamos la respuesta esperando los emails
  Promise.all(admins.map(a => sendMailFromTemplate('AUSENCIA_NUEVA', {
    to: a.email,
    vars: {
      apellido: solicitud.employee.apellido,
      nombre: solicitud.employee.nombre,
      legajo: solicitud.employee.legajo,
      tipoAusencia: solicitud.tipoAusencia.nombre,
      rango,
      dias: String(dias),
      bloqueMotivo: motivo?.trim() ? `<li><strong>Motivo:</strong> ${motivo.trim()}</li>` : '',
    },
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/solicitudes`,
  }))).catch(e => console.error('[email/ausencia-solicitud] fallo:', e))

  return NextResponse.json(solicitud, { status: 201 })
}
