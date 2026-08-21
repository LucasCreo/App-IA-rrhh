import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Nombres reservados por otros módulos (Licencias, aniversarios, formularios).
// No permitir crearlos como TipoEvento para evitar duplicaciones en el calendario.
const NOMBRES_RESERVADOS = new Set(['AUSENCIA', 'ANIVERSARIO', 'FORMULARIO', 'FORMULARIO_VENCIMIENTO'])

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const tipos = await prisma.tipoEvento.findMany({ orderBy: { nombre: 'asc' } })
    return NextResponse.json(tipos)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'EMPLOYEE') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { nombre, color, permiteAdmin, permiteEmpleado } = await req.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    const nombreNorm = nombre.trim().toUpperCase()
    if (NOMBRES_RESERVADOS.has(nombreNorm)) {
      return NextResponse.json({ error: `"${nombreNorm}" es un nombre reservado por otro módulo del sistema` }, { status: 400 })
    }
    const tipo = await prisma.tipoEvento.create({
      data: {
        nombre: nombreNorm,
        color: color ?? '#6b7280',
        permiteAdmin: permiteAdmin !== false,
        permiteEmpleado: !!permiteEmpleado,
      },
    })
    return NextResponse.json(tipo, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
