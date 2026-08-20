import type { AditusUploadProperties } from './aditus'

interface EmpleadoMin {
  legajo: string
  nombre: string
  apellido: string
  cuil: string
}

/** Metadata para un recibo ya asignado a un empleado. */
export function reciboProps(opts: {
  empleado: EmpleadoMin
  periodo?: string | null
  loteNombre?: string | null
}): AditusUploadProperties {
  const { empleado, periodo, loteNombre } = opts
  const perioStr = periodo ? ` ${periodo}` : ''
  return {
    objectTitle: `Recibo ${empleado.apellido} ${empleado.nombre}${perioStr}`.trim(),
    legajo: empleado.legajo,
    cuil: empleado.cuil,
    tipoDocumento: loteNombre ? `Recibo de sueldo - ${loteNombre}` : 'Recibo de sueldo',
  }
}

/** Metadata para un archivo pendiente de asignación dentro de un lote. */
export function reciboPendienteProps(opts: {
  fileName: string
  loteNombre: string
}): AditusUploadProperties {
  return {
    objectTitle: opts.fileName,
    tipoDocumento: `Recibo de sueldo pendiente - ${opts.loteNombre}`,
  }
}
