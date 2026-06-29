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

    console.log('[detectar-legajo] texto extraído (primeros 1500 chars):', text.slice(0, 1500))
    console.log('[detectar-legajo] legajo detectado:', legajo)

    return NextResponse.json({ legajo, debug: text.slice(0, 1500) })
  } catch (e: any) {
    return NextResponse.json({ legajo: null, error: e?.message ?? 'Error al leer el PDF' })
  }
}
