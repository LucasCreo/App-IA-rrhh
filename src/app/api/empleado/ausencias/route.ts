import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { writeFile } from 'fs/promises'
import path from 'path'

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
  })
  return NextResponse.json(solicitud, { status: 201 })
}
