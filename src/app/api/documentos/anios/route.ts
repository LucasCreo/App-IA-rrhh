import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'
import { Prisma } from '@prisma/client'

const RECIBO_TIPO = 'Recibo de Sueldo'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const reciboParam = searchParams.get('recibo')
  const sinLote = searchParams.get('sinLote') === 'true'

  const effectiveEmployeeId = user.role === 'EMPLOYEE'
    ? user.employeeId
    : (employeeId ? Number(employeeId) : undefined)

  const scope = user.role === 'ADMIN' ? await getScopedEmployeeIds(user.userId) : null
  if (scope && effectiveEmployeeId && !scope.has(effectiveEmployeeId)) {
    return NextResponse.json({ anios: [] })
  }

  const employeeIdFilter = effectiveEmployeeId
    ? { employeeId: effectiveEmployeeId }
    : scope
      ? { employeeId: { in: [...scope] } }
      : {}

  const reciboFilter = reciboParam === 'true'
    ? { tipoDocumento: { nombre: RECIBO_TIPO } }
    : reciboParam === 'false'
      ? { OR: [{ tipoDocumentoId: null }, { tipoDocumento: { nombre: { not: RECIBO_TIPO } } }] }
      : {}

  const where: Prisma.DocumentWhereInput = {
    ...employeeIdFilter,
    ...reciboFilter,
    ...(sinLote ? { loteId: null } : {}),
    periodo: { not: null },
  }

  const docs = await prisma.document.findMany({
    where,
    select: { periodo: true },
    take: 5000,
  })

  const anios = new Set<string>()
  for (const d of docs) {
    if (!d.periodo) continue
    const y = d.periodo.split('-')[0]
    if (/^\d{4}$/.test(y)) anios.add(y)
  }
  return NextResponse.json({ anios: [...anios].sort((a, b) => Number(b) - Number(a)) })
}
