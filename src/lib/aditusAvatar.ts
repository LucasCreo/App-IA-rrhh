import type { AditusUploadProperties } from './aditus'

interface EmpleadoMin {
  nombre: string
  apellido: string
  legajo?: string | null
  cuil?: string | null
}

/** Metadata para una imagen de perfil almacenada en Aditus. */
export function avatarProps(empleado: EmpleadoMin): AditusUploadProperties {
  return {
    objectTitle: `${empleado.nombre} ${empleado.apellido} - Imagen de perfil`.trim(),
    legajo: empleado.legajo ?? undefined,
    cuil: empleado.cuil ?? undefined,
    tipoDocumento: 'Imagen de perfil',
  }
}
