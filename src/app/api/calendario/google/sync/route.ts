import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOAuthClient, pushEventoToGoogleCalendars } from '@/lib/google'
import { google } from 'googleapis'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const decoded = await verifyToken(token)
  if (!decoded.userId || !decoded.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { googleRefreshToken: true },
  })

  if (!user?.googleRefreshToken) {
    return NextResponse.json({
      error: 'Google Calendar no está conectado. Conectá tu cuenta desde la configuración para sincronizar.',
      code: 'GOOGLE_NOT_CONNECTED',
    }, { status: 400 })
  }

  const auth = getOAuthClient()
  auth.setCredentials({ refresh_token: user.googleRefreshToken })

  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 1)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: threeMonthsAgo.toISOString(),
    timeMax: threeMonthsAhead.toISOString(),
    singleEvents: true,
    maxResults: 250,
  })

  const items = res.data.items ?? []

  for (const item of items) {
    if (!item.id || !item.summary) continue

    const isAllDay = !!item.start?.date
    const fechaInicio = isAllDay
      ? new Date(item.start!.date!)
      : new Date(item.start!.dateTime!)
    const fechaFin = item.end
      ? isAllDay ? new Date(item.end.date!) : new Date(item.end.dateTime!)
      : null

    const existing = await prisma.evento.findFirst({ where: { googleEventId: item.id } })
    if (existing) {
      await prisma.evento.update({
        where: { id: existing.id },
        data: {
          titulo: item.summary,
          descripcion: item.description ?? null,
          fechaInicio,
          fechaFin,
          todoElDia: isAllDay,
        },
      })
    } else {
      await prisma.evento.create({
        data: {
          titulo: item.summary,
          descripcion: item.description ?? null,
          fechaInicio,
          fechaFin,
          todoElDia: isAllDay,
          tipo: 'Google Calendar',
          googleEventId: item.id,
          creadoPorId: decoded.userId,
          asignados: { create: { employeeId: decoded.employeeId } },
        },
      })
    }
  }

  const googleIds = items.map(i => i.id).filter(Boolean) as string[]
  await prisma.evento.deleteMany({
    where: {
      creadoPorId: decoded.userId,
      googleEventId: { not: null, notIn: googleIds },
    },
  })

  // Push de eventos creados en la app (sin googleEventId) al Google Calendar del usuario
  const pendientes = await prisma.evento.findMany({
    where: {
      googleEventId: null,
      OR: [
        { creadoPorId: decoded.userId },
        { asignados: { some: { employeeId: decoded.employeeId } } },
      ],
    },
    select: { id: true },
  })
  for (const ev of pendientes) {
    await pushEventoToGoogleCalendars(ev.id, [decoded.userId])
  }

  const syncedAt = new Date()
  await prisma.user.update({
    where: { id: decoded.userId },
    data: { googleLastSync: syncedAt },
  })

  return NextResponse.json({
    synced: items.length,
    pushed: pendientes.length,
    syncedAt: syncedAt.toISOString(),
  })
}
