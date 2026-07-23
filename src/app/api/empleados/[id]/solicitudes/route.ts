import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds, getDescendantEmployeeIds } from '@/lib/scope'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const empId = Number(id)

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(empId)) return NextResponse.json({ error: 'Fuera de tu jerarquía' }, { status: 403 })

  const descendants = await getDescendantEmployeeIds(user.userId)

  const [docs, ausencias] = await Promise.all([
    prisma.solicitudDocumento.findMany({
      where: { employeeId: empId },
      include: { tipo: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.solicitudAusencia.findMany({
      where: { employeeId: empId },
      include: { tipoAusencia: { select: { id: true, nombre: true, color: true, afectaSaldo: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    documentos: docs.map(s => ({
      ...s,
      tipo: { ...s.tipo, campos: JSON.parse(s.tipo.campos ?? '[]') },
      canApprove: descendants.has(s.employeeId),
    })),
    ausencias: ausencias.map(s => ({ ...s, canApprove: descendants.has(s.employeeId) })),
  })
}
