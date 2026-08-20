import type { AditusUploadProperties } from './aditus'

interface EmpleadoMin {
  legajo: string
}

/** Metadata para un DocumentoGrupo (archivo masivo asignado a N empleados). */
export function documentoGrupoProps(opts: {
  nombreArchivo: string
  tipoDocumentoNombre?: string | null
  empleados: EmpleadoMin[]
}): AditusUploadProperties {
  const legajos = opts.empleados.map(e => e.legajo).filter(Boolean)
  const detalles = legajos.length > 0
    ? `Aplica al legajo: ${legajos.join(' - ')}`
    : undefined
  return {
    objectTitle: opts.nombreArchivo,
    tipoDocumento: opts.tipoDocumentoNombre ?? undefined,
    detalles,
  }
}
