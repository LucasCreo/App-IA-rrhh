import { prisma } from './prisma'

/**
 * Cachea el ID del tipo "Recibo de Sueldo" (raramente cambia) para evitar
 * el findFirst en cada creación de lote.
 */
let cachedReciboTipoId: number | null | undefined

export async function getReciboTipoId(): Promise<number | null> {
  if (cachedReciboTipoId !== undefined) return cachedReciboTipoId
  const tipo = await prisma.tipoDocumento.findFirst({
    where: { nombre: 'Recibo de Sueldo' },
    select: { id: true },
  })
  cachedReciboTipoId = tipo?.id ?? null
  return cachedReciboTipoId
}

/** Invalidar el cache si se llegara a renombrar/borrar el tipo desde configuración. */
export function invalidateReciboTipoCache() {
  cachedReciboTipoId = undefined
}
