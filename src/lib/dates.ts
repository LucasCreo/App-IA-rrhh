/**
 * Parsea un string de fecha del cliente sin desfase por zona horaria.
 * - "YYYY-MM-DD" (fecha pura, ej. input type=date) → local mediodía del día indicado.
 *   Se usa mediodía para que ningún cambio de DST corra el día.
 * - "YYYY-MM-DDTHH:mm[:ss]" (sin zona) → Date local con esa hora.
 * - Strings con zona ("Z" o "+HH:MM") → new Date normal (respeta la zona explícita).
 */
export function parseClientDate(s: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  const localDateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

  if (dateOnly.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0)
  }

  const dt = localDateTime.exec(s)
  if (dt) {
    const [, y, mo, d, h, mi, se] = dt
    return new Date(+y, +mo - 1, +d, +h, +mi, +(se ?? 0))
  }

  return new Date(s)
}
