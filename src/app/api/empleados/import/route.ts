import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requirePermiso, hashPassword } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { validarCuil } from '@/lib/cuil'

type RowError = { row: number; error: string }

function parseFecha(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return new Date(Date.UTC(d.y, d.m - 1, d.d))
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed) return null
    // Soporta yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy
    const iso = /^\d{4}-\d{2}-\d{2}$/
    if (iso.test(trimmed)) return new Date(trimmed + 'T12:00:00')
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const defaultPassword = ((formData.get('defaultPassword') as string) || 'cambiar123').trim()
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  if (defaultPassword.length < 6) {
    return NextResponse.json({ error: 'La contraseña por defecto debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const cats = await prisma.category.findMany({ select: { id: true, nombre: true } })
  const catByName = new Map(cats.map(c => [c.nombre.toLowerCase(), c.id]))

  const passwordHash = await hashPassword(defaultPassword)
  const errors: RowError[] = []
  let created = 0

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // headers + 1-indexed
    const norm = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), typeof v === 'string' ? v.trim() : v])
    ) as Record<string, any>

    const legajo = String(norm.legajo ?? '').trim()
    const nombre = String(norm.nombre ?? '').trim()
    const apellido = String(norm.apellido ?? '').trim()
    const cuil = String(norm.cuil ?? '').trim()
    const email = String(norm.email ?? '').trim().toLowerCase()
    const telefono = String(norm.telefono ?? '').trim() || null
    const fechaIngreso = parseFecha(norm['fechaingreso'] ?? norm['fecha ingreso'] ?? norm['fecha_ingreso'])
    const categoria = String(norm.categoria ?? '').trim()

    if (!legajo || !nombre || !apellido || !cuil || !email || !categoria || !fechaIngreso) {
      errors.push({ row: rowNum, error: 'Faltan campos obligatorios (legajo, nombre, apellido, cuil, email, categoria, fechaIngreso)' })
      continue
    }
    if (!validarCuil(cuil)) {
      errors.push({ row: rowNum, error: `CUIL "${cuil}" inválido` })
      continue
    }
    const catId = catByName.get(categoria.toLowerCase())
    if (!catId) {
      errors.push({ row: rowNum, error: `Categoría "${categoria}" no existe` })
      continue
    }

    try {
      await prisma.$transaction(async tx => {
        const emp = await tx.employee.create({
          data: {
            legajo, nombre, apellido, cuil, email,
            telefono, fechaIngreso, categoriaId: catId, estado: 'ACTIVO',
          },
        })
        await tx.user.create({
          data: {
            email, passwordHash, role: 'EMPLOYEE', employeeId: emp.id,
          },
        })
      })
      created++
    } catch (e: any) {
      const code = e?.code
      if (code === 'P2002') errors.push({ row: rowNum, error: 'Legajo, CUIL o email ya existente' })
      else errors.push({ row: rowNum, error: e?.message ?? 'Error desconocido' })
    }
  }

  await logAction(user.userId, 'IMPORTAR_EMPLEADOS', 'Empleado', `${created} creados · ${errors.length} errores`)
  return NextResponse.json({ created, errors, total: rows.length })
}
