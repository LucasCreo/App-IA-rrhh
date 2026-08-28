/**
 * Contrato común de validadores de archivos de recibos.
 * Un validator recibe el buffer + contexto y devuelve errores/warnings/metadata.
 * Los validators son reutilizables tanto en el flujo manual (POST /api/lotes)
 * como en el flujo SFTP (worker), y se pueden componer en un pipeline.
 */

export interface EmpleadoMin {
  id: number
  legajo: string
  nombre: string
  apellido: string
  cuil: string
}

export interface ValidatorContext {
  /** Legajos válidos (activos, en scope). */
  legajosValidos: Set<string>
  /** Empleados indexados por legajo para lookup rápido. */
  empByLegajo: Map<string, EmpleadoMin>
  /** Plantillas del nomenclador configuradas. */
  patterns: string[]
}

export interface ValidatorInput extends ValidatorContext {
  buffer: Buffer
  fileName: string
  /** Metadata acumulada por los validators previos en el pipeline. */
  metadata: Record<string, unknown>
}

export interface ValidatorIssue {
  code: string
  message: string
  validator?: string
}

export interface ValidatorResult {
  errors: ValidatorIssue[]
  warnings: ValidatorIssue[]
  /** Metadata para pasar al próximo validator (ej: legajo detectado). */
  metadata?: Record<string, unknown>
  /**
   * Si es true, los validators siguientes NO se ejecutan (short-circuit).
   * Útil para bloquear en errores fatales (PDF inválido).
   */
  fatal?: boolean
}

export interface Validator {
  name: string
  run(input: ValidatorInput): Promise<ValidatorResult>
}

export interface PipelineResult {
  pass: boolean
  errors: ValidatorIssue[]
  warnings: ValidatorIssue[]
  metadata: Record<string, unknown>
}
