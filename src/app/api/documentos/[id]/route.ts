import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { unlink } from 'fs/promises'
import { getScopedEmployeeIds } from '@/lib/scope'

async function assertScopeOnDoc(userId: number, docEmployeeId: number) {
  const scope = await getScopedEmployeeIds(userId)
  if (scope && !scope.has(docEmployeeId)) return false
  return true
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const doc = await prisma.document.findUnique({
    where: { id: Number(id) },
    include: { employee: true, cargadoPor: { select: { email: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role === 'EMPLOYEE' && doc.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  if (user.role === 'ADMIN' && !(await assertScopeOnDoc(user.userId, doc.employeeId))) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  return NextResponse.json(doc)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const existing = await prisma.document.findUnique({ where: { id: Number(id) }, select: { employeeId: true } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!(await assertScopeOnDoc(user.userId, existing.employeeId))) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  const body = await req.json()
  const doc = await prisma.document.update({
    where: { id: Number(id) },
    data: { estado: body.estado, fechaFirma: body.fechaFirma },
  })
  return NextResponse.json(doc)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const existing = await prisma.document.findUnique({ where: { id: Number(id) }, select: { employeeId: true } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!(await assertScopeOnDoc(user.userId, existing.employeeId))) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  const doc = await prisma.document.delete({ where: { id: Number(id) } })
  try { await unlink(doc.filePath) } catch { /* file may not exist */ }
  await logAction(user.userId, 'ELIMINAR', 'Documento', doc.nombreArchivo)
  return NextResponse.json({ ok: true })
}
