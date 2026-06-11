import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

const DEFAULTS = [
  { campo: 'legajo', visible: true, requerido: true },
  { campo: 'cuil', visible: true, requerido: true },
  { campo: 'email', visible: true, requerido: true },
  { campo: 'telefono', visible: true, requerido: false },
  { campo: 'fechaIngreso', visible: true, requerido: true },
  { campo: 'categoria', visible: true, requerido: true },
  { campo: 'estado', visible: true, requerido: true },
]

export async function GET() {
  const saved = await prisma.employeeFieldConfig.findMany()
  const savedMap = Object.fromEntries(saved.map(c => [c.campo, c]))
  return NextResponse.json(
    DEFAULTS.map(f => ({ ...f, ...(savedMap[f.campo] ? { visible: savedMap[f.campo].visible, requerido: savedMap[f.campo].requerido } : {}) }))
  )
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fields: Array<{ campo: string; visible: boolean; requerido: boolean }> = await req.json()
  await Promise.all(fields.map(f =>
    prisma.employeeFieldConfig.upsert({
      where: { campo: f.campo },
      update: { visible: f.visible, requerido: f.requerido },
      create: { campo: f.campo, visible: f.visible, requerido: f.requerido },
    })
  ))
  return NextResponse.json({ ok: true })
}
