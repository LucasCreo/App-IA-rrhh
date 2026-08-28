import type { PipelineResult, Validator, ValidatorInput, ValidatorIssue } from './types'

export * from './types'
export { pdfIntegridadValidator } from './pdfIntegridad'
export { nomencladorValidator } from './nomenclador'
export { legajoExistenteValidator } from './legajo'

/**
 * Ejecuta un pipeline de validators sobre un input. Acumula todos los errores
 * y warnings (no corta al primer error, salvo que un validator devuelva
 * `fatal: true`). La metadata se propaga entre validators.
 */
export async function runValidators(
  validators: Validator[],
  input: Omit<ValidatorInput, 'metadata'>,
): Promise<PipelineResult> {
  const errors: ValidatorIssue[] = []
  const warnings: ValidatorIssue[] = []
  let metadata: Record<string, unknown> = {}

  for (const v of validators) {
    const res = await v.run({ ...input, metadata })
    for (const e of res.errors) errors.push({ ...e, validator: e.validator ?? v.name })
    for (const w of res.warnings) warnings.push({ ...w, validator: w.validator ?? v.name })
    if (res.metadata) metadata = { ...metadata, ...res.metadata }
    if (res.fatal) break
  }

  return { pass: errors.length === 0, errors, warnings, metadata }
}
