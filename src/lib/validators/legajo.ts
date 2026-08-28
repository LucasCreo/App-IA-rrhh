import { detectarLegajoDesdeFilename } from '@/lib/recibosDetect'
import type { EmpleadoMin, Validator } from './types'

/**
 * Resuelve el empleado del recibo:
 * 1. Toma el legajo detectado por el nomenclador (si vino en metadata).
 * 2. Si no, usa el fallback numérico genérico de `detectarLegajoDesdeFilename`.
 * 3. Chequea que exista en el maestro (scope-aware).
 *
 * Emite error si no encuentra empleado. Guarda `empleado` y `legajo` finales
 * en metadata para que el caller cree el Document sin recalcular.
 */
export const legajoExistenteValidator: Validator = {
  name: 'legajo',
  async run({ fileName, patterns, legajosValidos, empByLegajo, metadata }) {
    const basename = fileName.replace(/^.*[\\/]/, '')
    // 1. Preferimos el legajo del nomenclador si el validator anterior lo dejó.
    const legajoNomen = typeof metadata.legajoNomenclador === 'string' ? metadata.legajoNomenclador : null
    let legajoFinal: string | null = null
    if (legajoNomen) {
      // Normaliza (matchea contra el maestro ignorando ceros a la izquierda)
      // usando la lógica ya centralizada en detectarLegajoDesdeFilename para
      // un único origen de verdad.
      legajoFinal = detectarLegajoDesdeFilename(legajoNomen, legajosValidos, [])
    }
    if (!legajoFinal) {
      // Fallback: patrones + numérico genérico (comportamiento histórico).
      legajoFinal = detectarLegajoDesdeFilename(basename, legajosValidos, patterns)
    }

    if (!legajoFinal) {
      return {
        errors: [{
          code: 'LEGAJO_NO_DETECTADO',
          message: `${basename}: no se pudo identificar el legajo`,
        }],
        warnings: [],
      }
    }

    const empleado = empByLegajo.get(legajoFinal) as EmpleadoMin | undefined
    if (!empleado) {
      // Improbable (matchLegajo ya validó contra el set), pero defensivo.
      return {
        errors: [{
          code: 'LEGAJO_INEXISTENTE',
          message: `${basename}: legajo "${legajoFinal}" no existe en el maestro`,
        }],
        warnings: [],
      }
    }

    return {
      errors: [],
      warnings: [],
      metadata: { legajo: legajoFinal, empleado },
    }
  },
}
