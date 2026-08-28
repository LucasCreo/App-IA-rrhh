import { isPdfBuffer, MAX_PDF_SIZE } from '@/lib/pdf'
import type { Validator } from './types'

/**
 * Chequea magic bytes de PDF y tamaño máximo. Si falla, marca `fatal` para
 * evitar seguir procesando (no tiene sentido buscar legajo en algo que no
 * es un PDF).
 */
export const pdfIntegridadValidator: Validator = {
  name: 'pdfIntegridad',
  async run({ buffer, fileName }) {
    if (buffer.length > MAX_PDF_SIZE) {
      const mb = MAX_PDF_SIZE / (1024 * 1024)
      return {
        errors: [{ code: 'PDF_TAMANIO_EXCEDIDO', message: `${fileName}: supera ${mb} MB` }],
        warnings: [],
        fatal: true,
      }
    }
    if (!isPdfBuffer(buffer)) {
      return {
        errors: [{ code: 'PDF_INVALIDO', message: `${fileName}: no es un PDF válido` }],
        warnings: [],
        fatal: true,
      }
    }
    return { errors: [], warnings: [] }
  },
}
