import type { AditusUploadProperties } from './aditus'

interface EmpleadoMin {
  legajo: string
  cuil: string
}

/** Metadata para archivos adjuntos a una solicitud de documento. */
export function solicitudProps(opts: {
  empleado: EmpleadoMin
  tipoNombre?: string | null
  fileName: string
  detalles?: string | null
}): AditusUploadProperties {
  return {
    objectTitle: opts.fileName,
    legajo: opts.empleado.legajo,
    cuil: opts.empleado.cuil,
    tipoDocumento: opts.tipoNombre ? `Solicitud - ${opts.tipoNombre}` : 'Solicitud',
    detalles: opts.detalles ?? undefined,
  }
}

/** Metadata para archivos adjuntos a una respuesta de formulario. */
export function formularioProps(opts: {
  empleado: EmpleadoMin
  plantillaNombre?: string | null
  fileName: string
  detalles?: string | null
}): AditusUploadProperties {
  return {
    objectTitle: opts.fileName,
    legajo: opts.empleado.legajo,
    cuil: opts.empleado.cuil,
    tipoDocumento: opts.plantillaNombre ? `Formulario - ${opts.plantillaNombre}` : 'Formulario',
    detalles: opts.detalles ?? undefined,
  }
}

/** Metadata para archivos adjuntos a una solicitud de ausencia/licencia. */
export function ausenciaProps(opts: {
  empleado: EmpleadoMin
  tipoAusenciaNombre?: string | null
  fileName: string
  detalles?: string | null
}): AditusUploadProperties {
  return {
    objectTitle: opts.fileName,
    legajo: opts.empleado.legajo,
    cuil: opts.empleado.cuil,
    tipoDocumento: opts.tipoAusenciaNombre ? `Ausencia - ${opts.tipoAusenciaNombre}` : 'Ausencia',
    detalles: opts.detalles ?? undefined,
  }
}

// ── Refs a archivos guardados (compound "aditusId||nombreOriginal") ────────

const SEP = '||'

export function encodeArchivoRef(aditusId: string, nombreOriginal: string): string {
  return `${aditusId}${SEP}${nombreOriginal.replace(/\|\|/g, '_')}`
}

export function parseArchivoRef(ref: string): { aditusId: string; nombre: string } {
  const idx = ref.indexOf(SEP)
  if (idx === -1) return { aditusId: ref, nombre: ref }
  return { aditusId: ref.slice(0, idx), nombre: ref.slice(idx + SEP.length) }
}

/** Nombre para mostrar al usuario (sin id ni prefijo timestamp legacy). */
export function displayNameFromRef(ref: string | null | undefined): string {
  if (!ref) return ''
  const { nombre } = parseArchivoRef(ref)
  // legacy: si no hay compound, aún puede tener prefijo timestamp
  return nombre.replace(/^\d+-/, '')
}

/** Extrae el ref (id||nombre) desde una URL de /api/.../archivo?file=... */
export function refFromArchivoUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url, 'http://x')
    return u.searchParams.get('file') ?? ''
  } catch {
    return ''
  }
}

/** Nombre display extraído directamente de una URL de archivo (compound o legacy). */
export function displayNameFromArchivoUrl(url: string | null | undefined): string {
  if (!url) return ''
  const ref = refFromArchivoUrl(url)
  if (ref) return displayNameFromRef(ref)
  // legacy: /uploads/xxx/timestamp-name.pdf → extract last segment
  const last = url.split('/').pop() ?? ''
  return last.replace(/^\d+-/, '')
}
