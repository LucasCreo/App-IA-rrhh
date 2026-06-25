import { google } from 'googleapis'

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
