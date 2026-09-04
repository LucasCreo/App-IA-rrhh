import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { uploadAditusFile, deleteAditusFile } from '@/lib/aditus'
import { reciboProps, reciboPendienteProps } from '@/lib/aditusRecibos'
import { actualizarProgresoLote } from '@/lib/loteProgress'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const lote = await prisma.lote.findUnique({
      where: { id: Number(id) },
      select: { id: true, nombre: true, periodo: true, tipoDocumentoId: true },
    })
    if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

    const formData = await req.formData()

    let uploaded = 0
    let asignados = 0
    let duplicados = 0
    const errors: string[] = []
    let i = 0

    while (formData.has(`file_${i}`)) {
      const file = formData.get(`file_${i}`) as File
      const employeeId = Number(formData.get(`employeeId_${i}`))
      i++

      if (!file || !employeeId) {
        errors.push(`Archivo ${i}: datos incompletos`)
        continue
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      if (buffer.length > MAX_FILE_SIZE) {
        errors.push(`${file.name}: supera el límite de 10 MB`)
        continue
      }

      if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
        errors.push(`${file.name}: no es un PDF válido`)
        continue
      }

      const empleado = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { legajo: true, nombre: true, apellido: true, cuil: true },
      })
      if (!empleado) {
        errors.push(`${file.name}: empleado no encontrado`)
        continue
      }

      const nombreArchivoLimpio = file.name.replace(/^.*[\\/]/, '')

      // Duplicado: si el empleado ya tiene un recibo asignado en este lote,
      // el archivo NO se descarta — se sube a Aditus con props "pendiente"
      // y queda como LoteArchivoPendiente con motivo DUPLICADO_EN_LOTE
      // para que el admin decida manualmente si asignarlo/reemplazar/descartar.
      const dup = await prisma.document.findFirst({
        where: { loteId: lote.id, employeeId },
        select: { id: true },
      })

      let aditusId: string
      try {
        aditusId = await uploadAditusFile({
          content: buffer,
          fileName: nombreArchivoLimpio,
          contentType: 'application/pdf',
          properties: dup
            ? reciboPendienteProps({ fileName: nombreArchivoLimpio, loteNombre: lote.nombre })
            : reciboProps({ empleado, periodo: lote.periodo, loteNombre: lote.nombre }),
        })
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : 'error subiendo a Aditus'}`)
        continue
      }

      if (dup) {
        try {
          await prisma.loteArchivoPendiente.create({
            data: {
              loteId: lote.id,
              aditusId,
              nombreArchivo: nombreArchivoLimpio,
              legajoDetectado: empleado.legajo,
              motivos: JSON.stringify([{
                code: 'DUPLICADO_EN_LOTE',
                message: `El legajo ${empleado.legajo} ya tiene un archivo asignado en este lote`,
                validator: 'lote',
              }]),
            },
          })
          duplicados++
          uploaded++
        } catch (e) {
          try { await deleteAditusFile(aditusId) } catch { /* rollback */ }
          errors.push(`${file.name}: ${e instanceof Error ? e.message : 'error creando pendiente'}`)
        }
        continue
      }

      try {
        await prisma.document.create({
          data: {
            nombreArchivo: nombreArchivoLimpio,
            aditusId,
            periodo: lote.periodo,
            employeeId,
            cargadoPorId: user.userId,
            estado: 'BORRADOR',
            loteId: lote.id,
            ...(lote.tipoDocumentoId ? { tipoDocumentoId: lote.tipoDocumentoId } : {}),
          },
        })
        uploaded++
        asignados++

        await prisma.loteEmpleado.upsert({
          where: { loteId_employeeId: { loteId: lote.id, employeeId } },
          create: { loteId: lote.id, employeeId },
          update: {},
        })
      } catch (e) {
        try { await deleteAditusFile(aditusId) } catch { /* rollback */ }
        errors.push(`${file.name}: ${e instanceof Error ? e.message : 'error creando registro'}`)
      }
    }

    await actualizarProgresoLote(lote.id).catch(() => { /* best-effort */ })
    await logAction(
      user.userId,
      'AGREGAR_RECIBOS',
      'Lote',
      `${lote.nombre} — ${uploaded} archivo(s), ${asignados} asignado(s), ${duplicados} duplicado(s) en revisión`
    )
    return NextResponse.json({ uploaded, asignados, duplicados, errors }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
