import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
  )
}

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export function getCalendarWithToken(refreshToken: string) {
  const auth = getOAuthClient()
  auth.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth })
}

export function toGoogleEventBody(evento: {
  titulo: string
  descripcion?: string | null
  fechaInicio: Date
  fechaFin?: Date | null
  todoElDia: boolean
}) {
  const dateStr = (d: Date) => d.toISOString().slice(0, 10)
  const addDay = (d: Date) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n }
  const end = evento.fechaFin ?? evento.fechaInicio
  return {
    summary: evento.titulo,
    description: evento.descripcion ?? undefined,
    start: evento.todoElDia
      ? { date: dateStr(evento.fechaInicio) }
      : { dateTime: evento.fechaInicio.toISOString() },
    end: evento.todoElDia
      ? { date: dateStr(addDay(end)) }
      : { dateTime: end.toISOString() },
  }
}

// Pushea el evento al Google Calendar de cada userId que tenga refresh token.
// Devuelve el primer googleEventId obtenido (para guardar en la fila del evento).
export async function pushEventoToGoogleCalendars(eventoId: number, userIds: number[]) {
  const uniq = [...new Set(userIds.filter(Boolean))]
  if (uniq.length === 0) return

  const [evento, users] = await Promise.all([
    prisma.evento.findUnique({ where: { id: eventoId } }),
    prisma.user.findMany({
      where: { id: { in: uniq }, googleRefreshToken: { not: null } },
      select: { id: true, googleRefreshToken: true },
    }),
  ])
  if (!evento || users.length === 0) return

  const body = toGoogleEventBody({
    titulo: evento.titulo,
    descripcion: evento.descripcion,
    fechaInicio: evento.fechaInicio,
    fechaFin: evento.fechaFin,
    todoElDia: evento.todoElDia,
  })

  let firstGoogleId: string | null = evento.googleEventId ?? null
  for (const u of users) {
    try {
      const gcal = getCalendarWithToken(u.googleRefreshToken!)
      const res = await gcal.events.insert({ calendarId: 'primary', requestBody: body })
      if (!firstGoogleId && res.data.id) firstGoogleId = res.data.id
    } catch (e) {
      console.error(`[google] insert event failed for userId=${u.id}:`, (e as Error).message)
    }
  }
  if (firstGoogleId && firstGoogleId !== evento.googleEventId) {
    await prisma.evento.update({ where: { id: eventoId }, data: { googleEventId: firstGoogleId } })
  }
}
