import { prisma } from './prisma'

export async function logAction(
  userId: number,
  accion: string,
  entidad: string,
  detalle?: string
) {
  await prisma.auditLog.create({ data: { userId, accion, entidad, detalle } })
}
