import { toast } from 'sonner'

export interface DetectedData {
  legajo: string | null
  cuil: string | null
  nombre: string | null
  apellido: string | null
}

export interface RecibosEntry {
  file: File
  empleadoId: string
  legajoDetectado: string | null
  cuilDetectado: string | null
  nombreDetectado: string | null
  apellidoDetectado: string | null
  matched: boolean
  detectando: boolean
}

/**
 * Detecta el legajo, CUIL y nombre desde un PDF de recibo llamando a
 * /api/lotes/detectar-legajo. Si falla, muestra un toast con el motivo.
 */
export async function detectarLegajoPdf(file: File): Promise<DetectedData> {
  const empty: DetectedData = { legajo: null, cuil: null, nombre: null, apellido: null }
  try {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/lotes/detectar-legajo', { method: 'POST', body: fd })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      let msg = `No se pudo leer "${file.name}"`
      try {
        const parsed = JSON.parse(text)
        if (parsed?.error) msg = `"${file.name}": ${parsed.error}`
      } catch { /* texto plano */ }
      toast.error(msg)
      console.error('[detectarLegajoPdf]', r.status, text)
      return empty
    }
    const data = await r.json()
    return {
      legajo: data.legajo ?? null,
      cuil: data.cuil ?? null,
      nombre: data.nombre ?? null,
      apellido: data.apellido ?? null,
    }
  } catch (e) {
    toast.error(`Error de red al detectar "${file.name}"`)
    console.error('[detectarLegajoPdf]', e)
    return empty
  }
}
