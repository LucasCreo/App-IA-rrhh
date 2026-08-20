/**
 * Registro en memoria de archivos recién subidos a Aditus por un usuario.
 * Sirve para autorizar la vista previa del archivo antes de que se guarde
 * en un SolicitudDocumento / RespuestaFormulario. TTL corto (1h).
 */
type Entry = { userId: number; expiresAt: number }
const recent = new Map<string, Entry>()
const TTL_MS = 60 * 60 * 1000

function cleanup() {
  const now = Date.now()
  for (const [k, v] of recent) if (v.expiresAt <= now) recent.delete(k)
}

export function marcarSubidoPor(aditusId: string, userId: number) {
  cleanup()
  recent.set(aditusId, { userId, expiresAt: Date.now() + TTL_MS })
}

export function fueSubidoRecientementePor(aditusId: string, userId: number): boolean {
  const e = recent.get(aditusId)
  if (!e) return false
  if (e.expiresAt <= Date.now()) { recent.delete(aditusId); return false }
  return e.userId === userId
}
