import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { sendMail } from '@/lib/email'

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

  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
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
    const ext = path.extname(archivo.name)
    const filename = `${user.employeeId}-${Date.now()}${ext}`
    const dest = path.join(process.cwd(), 'public', 'uploads', 'ausencias', filename)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, Buffer.from(await archivo.arrayBuffer()))
    archivoUrl = `/uploads/ausencias/${filename}`
  }

  const solicitud = await prisma.solicitudAusencia.create({
    data: {
      employeeId: user.employeeId,
      tipoAusenciaId: Number(tipoAusenciaId),
      fechaInicio: inicio,
      fechaFin: fin,
      dias,
      motivo: motivo?.trim() || null,
      archivoUrl,
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
      tipoAusencia: { select: { nombre: true } },
    },
  })

  // Notificar a admins con email
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', email: { not: '' } },
    select: { email: true },
  })
  const fmt = (d: Date) => d.toLocaleDateString('es-AR')
  const rango = `${fmt(inicio)} — ${fmt(fin)}`
  // Fire-and-forget: no bloqueamos la respuesta esperando los emails
  Promise.all(admins.map(a => sendMail({
    to: a.email,
    subject: `Nueva solicitud de ausencia — ${solicitud.employee.apellido}, ${solicitud.employee.nombre}`,
    title: 'Nueva solicitud de ausencia pendiente',
    bodyHtml: `
      <p><strong>${solicitud.employee.apellido}, ${solicitud.employee.nombre}</strong> (legajo ${solicitud.employee.legajo}) solicita una ausencia:</p>
      <ul>
        <li><strong>Tipo:</strong> ${solicitud.tipoAusencia.nombre}</li>
        <li><strong>Período:</strong> ${rango} (${dias} días hábiles)</li>
        ${motivo?.trim() ? `<li><strong>Motivo:</strong> ${motivo.trim()}</li>` : ''}
      </ul>
    `,
    ctaLabel: 'Revisar solicitud',
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/ausencias`,
  }))).catch(e => console.error('[email/ausencia-solicitud] fallo:', e))

  return NextResponse.json(solicitud, { status: 201 })
}
