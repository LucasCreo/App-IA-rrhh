import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS, TODOS_LOS_PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const roles = await prisma.rol.findMany({
    include: {
      permisos: { select: { permiso: true } },
      _count: { select: { usuarios: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(roles.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    scopeJerarquico: !!r.scopeJerarquico,
    createdAt: r.createdAt,
    permisos: r.permisos.map((p: any) => p.permiso),
    usuariosCount: r._count.usuarios,
  })))
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion, scopeJerarquico, permisos } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const permisosValidos = (permisos ?? []).filter((p: string) => TODOS_LOS_PERMISOS.includes(p as any))

  try {
    const rol = await prisma.rol.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        scopeJerarquico: !!scopeJerarquico,
        permisos: {
          create: permisosValidos.map((p: string) => ({ permiso: p })),
        },
      },
      include: { permisos: { select: { permiso: true } } },
    })
    return NextResponse.json({
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      scopeJerarquico: rol.scopeJerarquico,
      permisos: rol.permisos.map((p: any) => p.permiso),
      usuariosCount: 0,
    }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 409 })
    throw e
  }
}
