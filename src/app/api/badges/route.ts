import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'

const RECIBO_TIPO = 'Recibo de Sueldo'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({})

  if (user.role === 'ADMIN') {
    const scope = await getScopedEmployeeIds(user.userId)
    const employeeFilter = scope ? { employeeId: { in: [...scope] } } : {}

    // Documentos con errores/rechazos que requieren atención del admin
    const [docsErrores, lotesConError] = await Promise.all([
      prisma.document.count({
        where: { ...employeeFilter, estado: { in: ['ERROR', 'RECHAZADO'] } },
      }),
      prisma.lote.count({
        where: {
          documentos: { some: { estado: 'ERROR', ...employeeFilter } },
        },
      }),
    ])

    return NextResponse.json({
      documentos: docsErrores,
      recibos: lotesConError,
    })
  }

  if (!user.employeeId) return NextResponse.json({})

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { solicitudesLastSeenAt: true },
  })
  const since = dbUser?.solicitudesLastSeenAt ?? new Date(0)

  const [recibosPendientes, docsPendientes, solicitudesResueltas, ausenciasResueltas] = await Promise.all([
    // Recibos pendientes de firma/lectura
    prisma.document.count({
      where: {
        employeeId: user.employeeId,
        estado: 'ENVIADO_A_FIRMA',
        tipoDocumento: { nombre: RECIBO_TIPO },
      },
    }),
    // Otros documentos pendientes (asignaciones de grupo)
    prisma.documentoAsignacion.count({
      where: {
        employeeId: user.employeeId,
        estado: 'ENVIADO_A_FIRMA',
      },
    }),
    // Solicitudes de documentos resueltas después del último acceso
    prisma.solicitudDocumento.count({
      where: {
        employeeId: user.employeeId,
        estado: { in: ['APROBADO', 'RECHAZADO'] },
        updatedAt: { gt: since },
      },
    }),
    // Solicitudes de ausencia resueltas después del último acceso
    prisma.solicitudAusencia.count({
      where: {
        employeeId: user.employeeId,
        estado: { in: ['APROBADA', 'RECHAZADA'] },
        updatedAt: { gt: since },
      },
    }),
  ])

  return NextResponse.json({
    recibos: recibosPendientes,
    documentos: docsPendientes,
    solicitudes: solicitudesResueltas,
    licencias: ausenciasResueltas,
  })
}
