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
 * Convierte una plantilla con placeholders ({legajo}, {cuil}, {año}, {mes},
 * {apellido}, {nombre}, {*}) en un RegExp. `{legajo}` queda como grupo
 * capturado (posicional m[1]); `{año}`/`{ano}` y `{mes}` como grupos nombrados
 * `anio` y `mes` (accesibles vía m.groups?.anio / m.groups?.mes) además de
 * ocupar posiciones para el orden en el que aparecen. El resto es no-capturante.
 * Devuelve null si la plantilla es inválida.
 *
 * Ejemplos:
 *   "{legajo}_{apellido}.pdf"        → /^(\d+)_(?:[^/]+)\.pdf$/i
 *   "RS-{año}{mes}-{legajo}.pdf"    → /^RS-(?<anio>\d{4})(?<mes>\d{1,2})-(\d+)\.pdf$/i
 */
export function plantillaARegex(template: string): RegExp | null {
  // Normaliza: quita espacios alrededor de {placeholder} por si vienen sucios
  template = template.trim().replace(/\s*(\{[^}]+\})\s*/g, '$1')
  if (!template) return null
  const PLACEHOLDERS: Record<string, string> = {
    legajo: '\\d+',
    cuil: '[\\d-]{11,13}',
    año: '\\d{4}',
    ano: '\\d{4}',
    mes: '\\d{1,2}',
    apellido: '[^_\\-\\.\\s/]+',
    nombre: '[^_\\-\\.\\s/]+',
    '*': '.+?',
  }
  let hasLegajo = false
  let hasAnio = false
  let hasMes = false
  const parts: string[] = []
  let i = 0
  while (i < template.length) {
    if (template[i] === '{') {
      const end = template.indexOf('}', i)
      if (end < 0) return null
      const key = template.slice(i + 1, end).trim()
      const pattern = PLACEHOLDERS[key]
      if (!pattern) return null
      if (key === 'legajo') {
        if (hasLegajo) return null
        parts.push(`(${pattern})`)
        hasLegajo = true
      } else if (key === 'año' || key === 'ano') {
        if (hasAnio) return null
        parts.push(`(?<anio>${pattern})`)
        hasAnio = true
      } else if (key === 'mes') {
        if (hasMes) return null
        parts.push(`(?<mes>${pattern})`)
        hasMes = true
      } else {
        parts.push(`(?:${pattern})`)
      }
      i = end + 1
    } else {
      parts.push(template[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      i++
    }
  }
  if (!hasLegajo) return null
  try { return new RegExp('^' + parts.join('') + '$', 'i') } catch { return null }
}

export interface FilenameMetadata {
  legajo?: string
  mes?: number
  anio?: number
}

/**
 * Extrae metadata (legajo + mes + año) del nombre de archivo usando los
 * patrones del nomenclador. Devuelve el primer patrón que matchee, o null
 * si ninguno coincide. Los legajos NO se normalizan acá (eso lo hace
 * `matchLegajo` cuando se compara contra el maestro).
 */
export function extraerMetadataDesdeFilename(
  fileName: string,
  patterns: string[],
): FilenameMetadata | null {
  const basename = fileName.replace(/^.*[\\/]/, '')
  for (const tpl of patterns) {
    const re = plantillaARegex(tpl)
    if (!re) continue
    const m = basename.match(re)
    if (!m) continue
    const meta: FilenameMetadata = {}
    if (m[1]) meta.legajo = m[1]
    const anio = m.groups?.anio
    const mes = m.groups?.mes
    if (anio) meta.anio = Number(anio)
    if (mes) meta.mes = Number(mes)
    return meta
  }
  return null
}

/**
 * Extrae el legajo desde el nombre del archivo. Prioriza las plantillas
 * configuradas por el admin; si ninguna matchea (o no hay), cae al matcheo
 * genérico: cualquier número de 3-8 dígitos que exista como legajo.
 */
/**
 * Busca el legajo ignorando ceros a la izquierda de ambos lados.
 * Ej: capturado "00000001" contra un legajo "0001" en DB → matchea (ambos == "1" sin padding).
 * Devuelve el legajo real como está guardado en la DB.
 */
function matchLegajo(capturado: string, legajosValidos: Set<string>): string | null {
  if (legajosValidos.has(capturado)) return capturado
  const norm = capturado.replace(/^0+/, '') || '0'
  for (const l of legajosValidos) {
    if ((l.replace(/^0+/, '') || '0') === norm) return l
  }
  return null
}

export function detectarLegajoDesdeFilename(
  fileName: string,
  legajosValidos: Set<string>,
  patterns: string[] = [],
): string | null {
  const basename = fileName.replace(/^.*[\\/]/, '')
  for (const tpl of patterns) {
    const re = plantillaARegex(tpl)
    if (!re) continue
    const m = basename.match(re)
    if (m && m[1]) {
      const legajo = matchLegajo(m[1], legajosValidos)
      if (legajo) return legajo
    }
  }
  const nums = basename.match(/\d{3,8}/g) ?? []
  for (const n of nums) {
    const legajo = matchLegajo(n, legajosValidos)
    if (legajo) return legajo
  }
  return null
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

/**
 * Ejecuta un worker sobre una lista de items respetando una concurrencia máxima
 * y reportando progreso. Útil para no saturar server ni memoria del navegador
 * cuando se procesan cientos/miles de archivos.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  let done = 0
  async function pump() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
      done++
      onProgress?.(done, items.length)
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: n }, pump))
  return results
}
