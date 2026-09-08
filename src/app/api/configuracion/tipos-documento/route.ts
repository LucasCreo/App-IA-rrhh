import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export async function GET() {
  const tipos = await prisma.tipoDocumento.findMany({
    orderBy: [{ protegido: 'desc' }, { nombre: 'asc' }],
  })
  return NextResponse.json(tipos.map(t => ({
    ...t,
    // Enmascaramos el secret: sólo indicamos si está seteado
    firmaApiSecret: undefined,
    firmaApiSecretSet: !!t.firmaApiSecret,
    campos: t.campos ? JSON.parse(t.campos) : null,
  })))
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion, accion, metodoFirma, campos, tienePeriodo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const ACCIONES = ['FIRMA', 'LECTURA', 'NINGUNA']
  const METODOS_FIRMA = ['CONTRASENA', 'PROVEEDOR']
  const accionFinal = ACCIONES.includes(accion) ? accion : 'FIRMA'
  try {
    const tipo = await prisma.tipoDocumento.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        accion: accionFinal,
        // metodoFirma sólo es relevante si accion=FIRMA; para otros forzamos CONTRASENA por consistencia
        metodoFirma: accionFinal === 'FIRMA' && METODOS_FIRMA.includes(metodoFirma) ? metodoFirma : 'CONTRASENA',
        campos: campos ? JSON.stringify(campos) : null,
        tienePeriodo: tienePeriodo !== false,
      },
    })
    return NextResponse.json({ ...tipo, campos: tipo.campos ? JSON.parse(tipo.campos) : null }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo de documento con ese nombre' }, { status: 409 })
    }
    throw e
  }
}
