/**
 * Valida un CUIL/CUIT argentino: 11 dígitos con dígito verificador.
 * Acepta con o sin guiones. Devuelve true si es válido.
 *
 * Algoritmo:
 *  - Multiplica los primeros 10 dígitos por [5,4,3,2,7,6,5,4,3,2].
 *  - Suma los productos.
 *  - Resto = suma mod 11.
 *  - Dígito verificador = 11 - resto.
 *  - Casos especiales: si el resultado es 11 → 0, si es 10 → CUIL inválido.
 */
export function validarCuil(cuil: string): boolean {
  if (!cuil) return false
  const solo = cuil.replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(solo)) return false
  const digitos = solo.split('').map(Number)
  const coef = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = coef.reduce((acc, c, i) => acc + c * digitos[i], 0)
  const resto = suma % 11
  let verificador = 11 - resto
  if (verificador === 11) verificador = 0
  if (verificador === 10) return false
  return verificador === digitos[10]
}

/** Formatea a XX-XXXXXXXX-X si es válido (o largo 11). */
export function formatearCuil(cuil: string): string {
  const solo = cuil.replace(/\D/g, '')
  if (solo.length !== 11) return cuil
  return `${solo.slice(0, 2)}-${solo.slice(2, 10)}-${solo.slice(10)}`
}
