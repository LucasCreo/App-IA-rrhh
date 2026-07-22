// Feature flags para habilitar/deshabilitar módulos completos desde el frontend.
// El código y las tablas de la DB se mantienen intactos.

export const EVALUACIONES_ENABLED = false

// Modo de firma temporal: 'password' usa la contraseña del usuario en vez del
// proveedor externo. 'external' vuelve al flujo con SignatureConfig.
export const SIGNATURE_MODE: 'password' | 'external' = 'password'
