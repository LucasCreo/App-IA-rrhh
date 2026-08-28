import { extraerMetadataDesdeFilename } from '@/lib/recibosDetect'
import type { Validator } from './types'

/**
 * Parsea el nombre del archivo contra los patrones del nomenclador para
 * extraer legajo/mes/año. NO falla si no matchea ningún patrón: emite un
 * warning y deja que el `legajoExistenteValidator` intente el fallback
 * numérico. Esto preserva el comportamiento actual del flujo manual.
 */
export const nomencladorValidator: Validator = {
  name: 'nomenclador',
  async run({ fileName, patterns }) {
    const basename = fileName.replace(/^.*[\\/]/, '')
    if (patterns.length === 0) {
      // Sin patrones configurados: no es error, solo no aportamos metadata.
      return { errors: [], warnings: [] }
    }
    const meta = extraerMetadataDesdeFilename(basename, patterns)
    if (!meta) {
      return {
        errors: [],
        warnings: [{
          code: 'NOMENCLADOR_NO_MATCH',
          message: `${basename}: no coincide con ningún patrón configurado`,
        }],
      }
    }
    const out: Record<string, unknown> = {}
    if (meta.legajo) out.legajoNomenclador = meta.legajo
    if (meta.mes) out.mes = meta.mes
    if (meta.anio) out.anio = meta.anio
    return { errors: [], warnings: [], metadata: out }
  },
}
