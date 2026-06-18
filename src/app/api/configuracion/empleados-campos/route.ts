import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

const DEFAULTS = [
  { campo: 'legajo', visible: true, requerido: true, eliminado: false },
  { campo: 'cuil', visible: true, requerido: true, eliminado: false },
  { campo: 'email', visible: true, requerido: true, eliminado: false },
  { campo: 'telefono', visible: true, requerido: false, eliminado: false },
  { campo: 'fechaIngreso', visible: true, requerido: true, eliminado: false },
  { campo: 'categoria', visible: true, requerido: true, eliminado: false },
  { campo: 'estado', visible: true, requerido: true, eliminado: false },
]

export async function GET() {
  const saved = await prisma.employeeFieldConfig.findMany()
  const savedMap = Object.fromEntries(saved.map(c => [c.campo, c]))
  return NextResponse.json(
    DEFAULTS.map(f => ({
      ...f,
      ...(savedMap[f.campo]
        ? { visible: savedMap[f.campo].visible, requerido: savedMap[f.campo].requerido, eliminado: savedMap[f.campo].eliminado }
        : {}),
    }))
  )
}

export async function PUT(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fields: Array<{ campo: string; visible: boolean; requerido: boolean; eliminado?: boolean }> = await req.json()
  await Promise.all(fields.map(f =>
    prisma.employeeFieldConfig.upsert({
      where: { campo: f.campo },
      update: { visible: f.visible, requerido: f.requerido, eliminado: f.eliminado ?? false },
      create: { campo: f.campo, visible: f.visible, requerido: f.requerido, eliminado: f.eliminado ?? false },
    })
  ))
  return NextResponse.json({ ok: true })
}
