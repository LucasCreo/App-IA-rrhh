/**
 * Valida el formato de un CUIL/CUIT argentino.
 * Acepta dos formatos:
 *  - 11 dígitos sin separadores: `XXXXXXXXXXX`
 *  - Con guiones: `XX-XXXXXXXX-X`
 * NO valida el dígito verificador (solo la forma).
 */
export function validarCuil(cuil: string): boolean {
  if (!cuil) return false
  return /^\d{11}$/.test(cuil) || /^\d{2}-\d{8}-\d$/.test(cuil)
}

/** Formatea a XX-XXXXXXXX-X si tiene 11 dígitos; devuelve tal cual si no. */
export function formatearCuil(cuil: string): string {
  const solo = cuil.replace(/\D/g, '')
  if (solo.length !== 11) return cuil
  return `${solo.slice(0, 2)}-${solo.slice(2, 10)}-${solo.slice(10)}`
}
