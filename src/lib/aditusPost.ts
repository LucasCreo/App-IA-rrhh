import type { AditusUploadProperties } from './aditus'

interface EmpleadoMin {
  nombre: string
  apellido: string
  legajo?: string | null
  cuil?: string | null
}

/** Metadata para un adjunto subido desde el editor del portal (Avisos). */
export function avisoAdjuntoProps(opts: {
  fileName: string
  autorEmail: string
  autor?: EmpleadoMin | null
}): AditusUploadProperties {
  const autorLabel = opts.autor ? `${opts.autor.nombre} ${opts.autor.apellido}` : opts.autorEmail
  return {
    objectTitle: `Aviso - ${opts.fileName}`,
    legajo: opts.autor?.legajo ?? undefined,
    cuil: opts.autor?.cuil ?? undefined,
    tipoDocumento: 'Adjunto de Aviso',
    detalles: `Subido por ${autorLabel}`,
  }
}
