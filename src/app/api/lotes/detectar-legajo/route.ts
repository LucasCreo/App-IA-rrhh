import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { PDFParse } from 'pdf-parse'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return NextResponse.json({ legajo: null, error: 'No es un PDF válido' })
    }

    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    const text = result.text ?? ''

    const legajoIdx = text.search(/Legajo/i)
    let legajo: string | null = null
    if (legajoIdx >= 0) {
      const window = text.slice(legajoIdx, legajoIdx + 400)
      const m = window.match(/(?<![\d\/.,\-])(\d{3,6})(?![\d\/.,\-])/)
      if (m) legajo = m[1]
    }

    // CUIL/CUIT (con o sin guiones)
    let cuil: string | null = null
    const cuilMatch = text.match(/CUI[LT][^\d]{0,10}(\d{2}[-\s]?\d{7,8}[-\s]?\d)/i)
    if (cuilMatch) {
      const digits = cuilMatch[1].replace(/\D/g, '')
      if (digits.length === 11) cuil = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
    }

    // Nombre y apellido — busca después de "Apellido y Nombre" o similar
    let nombre: string | null = null
    let apellido: string | null = null
    const nombreLabel = text.match(/(?:Apellido\s+y\s+Nombres?|Empleado|Nombre\s+y\s+Apellido)[\s:]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]{4,80})/i)
    if (nombreLabel) {
      const raw = nombreLabel[1].split(/\r?\n|\s{3,}/)[0].trim()
      if (raw.includes(',')) {
        const [ap, no] = raw.split(',').map(s => s.trim())
        apellido = ap || null
        nombre = no || null
      } else {
        const parts = raw.split(/\s+/)
        if (parts.length >= 2) {
          apellido = parts[0]
          nombre = parts.slice(1).join(' ')
        }
      }
    }

    return NextResponse.json({ legajo, cuil, nombre, apellido })
  } catch (e: any) {
    return NextResponse.json({ legajo: null, error: e?.message ?? 'Error al leer el PDF' })
  }
}
