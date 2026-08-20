import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requirePermiso, hashPassword } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { validarCuil } from '@/lib/cuil'

type RowError = { row: number; email?: string; error: string }
type ExistingRow = { row: number; legajo: string; email: string; cuil: string; matches: string[] }

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
    const iso = /^\d{4}-\d{2}-\d{2}$/
    if (iso.test(trimmed)) return new Date(trimmed + 'T12:00:00')
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

interface ParsedRow {
  rowNum: number
  legajo: string
  nombre: string
  apellido: string
  cuil: string
  email: string
  telefono: string | null
  fechaIngreso: Date | null
  area: string
  categoria: string
  puesto: string | null
  password: string
  username: string | null
  rowErrors: string[]
}

function parseRow(raw: Record<string, unknown>, rowNum: number, catByName: Map<string, number>, areaByName: Map<string, number>): ParsedRow {
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
  const area = String(norm.area ?? '').trim() || 'General'
  const puesto = String(norm.puesto ?? '').trim() || null
  const password = String(norm.password ?? norm['contraseña'] ?? norm.contrasena ?? '').trim()
  const username = String(norm.username ?? norm['nombre de usuario'] ?? norm.usuario ?? '').trim() || null

  const faltantes: string[] = []
  if (!legajo) faltantes.push('legajo')
  if (!nombre) faltantes.push('nombre')
  if (!apellido) faltantes.push('apellido')
  if (!cuil) faltantes.push('cuil')
  if (!email) faltantes.push('email')
  if (!categoria) faltantes.push('categoria')
  if (!fechaIngreso) faltantes.push('fechaIngreso')
  if (!password) faltantes.push('password')

  const rowErrors: string[] = []
  if (faltantes.length > 0) rowErrors.push(`Faltan campos: ${faltantes.join(', ')}`)
  if (password && password.length < 6) rowErrors.push('La contraseña debe tener al menos 6 caracteres')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push(`Email "${email}" inválido`)
  if (cuil && !validarCuil(cuil)) rowErrors.push(`CUIL "${cuil}" inválido`)
  if (categoria && !catByName.has(categoria.toLowerCase())) rowErrors.push(`Categoría "${categoria}" no existe`)
  if (area && !areaByName.has(area.toLowerCase())) rowErrors.push(`Área "${area}" no existe`)

  return { rowNum, legajo, nombre, apellido, cuil, email, telefono, fechaIngreso, area, categoria, puesto, password, username, rowErrors }
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const createMissingCategorias = formData.get('createMissingCategorias') === 'true'
  const createMissingAreas = formData.get('createMissingAreas') === 'true'
  const preview = formData.get('preview') === 'true'
  const skipExisting = formData.get('skipExisting') === 'true'
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  let cats = await prisma.category.findMany({ select: { id: true, nombre: true } })
  let catByName = new Map(cats.map(c => [c.nombre.toLowerCase(), c.id]))

  // Asegurar que exista el área "General" (default para importaciones sin columna area)
  await prisma.area.upsert({ where: { nombre: 'General' }, update: {}, create: { nombre: 'General' } })
  let areas = await prisma.area.findMany({ select: { id: true, nombre: true } })
  let areaByName = new Map(areas.map(a => [a.nombre.toLowerCase(), a.id]))

  const catsEnPlanilla = new Map<string, string>()
  for (const raw of rows) {
    const c = String((raw as Record<string, unknown>)['categoria'] ?? (raw as Record<string, unknown>)['Categoria'] ?? '').trim()
    if (c && !catsEnPlanilla.has(c.toLowerCase())) catsEnPlanilla.set(c.toLowerCase(), c)
  }
  const missingCategorias = [...catsEnPlanilla.entries()]
    .filter(([lower]) => !catByName.has(lower))
    .map(([, original]) => original)

  // Detectar áreas faltantes en planilla
  const areasEnPlanilla = new Map<string, string>()
  for (const raw of rows) {
    const a = String((raw as Record<string, unknown>)['area'] ?? (raw as Record<string, unknown>)['Area'] ?? (raw as Record<string, unknown>)['Área'] ?? '').trim()
    if (a && !areasEnPlanilla.has(a.toLowerCase())) areasEnPlanilla.set(a.toLowerCase(), a)
  }
  const missingAreas = [...areasEnPlanilla.entries()]
    .filter(([lower]) => !areaByName.has(lower))
    .map(([, original]) => original)

  // En preview, seguimos con el resto. Sin preview y con nuevas categorías/áreas → pedir confirmación
  if (!preview && (
    (missingCategorias.length > 0 && !createMissingCategorias) ||
    (missingAreas.length > 0 && !createMissingAreas)
  )) {
    return NextResponse.json({
      needsConfirmation: true,
      missingCategorias,
      missingAreas,
      total: rows.length,
    })
  }

  if (missingCategorias.length > 0 && createMissingCategorias) {
    await prisma.category.createMany({ data: missingCategorias.map(nombre => ({ nombre })) })
    cats = await prisma.category.findMany({ select: { id: true, nombre: true } })
    catByName = new Map(cats.map(c => [c.nombre.toLowerCase(), c.id]))
  }

  if (missingAreas.length > 0 && createMissingAreas) {
    await prisma.area.createMany({ data: missingAreas.map(nombre => ({ nombre })) })
    areas = await prisma.area.findMany({ select: { id: true, nombre: true } })
    areaByName = new Map(areas.map(a => [a.nombre.toLowerCase(), a.id]))
  }

  // Parsear todas las filas
  const parsed = rows.map((raw, i) => parseRow(raw, i + 2, catByName, areaByName))

  // Buscar existentes en DB por legajo, email, cuil (dedupe query)
  const legajos = [...new Set(parsed.filter(p => p.legajo).map(p => p.legajo))]
  const emails = [...new Set(parsed.filter(p => p.email).map(p => p.email))]
  const cuils = [...new Set(parsed.filter(p => p.cuil).map(p => p.cuil))]
  const [empByLegajo, empByEmail, empByCuil, userByEmail] = await Promise.all([
    legajos.length > 0 ? prisma.employee.findMany({ where: { legajo: { in: legajos } }, select: { legajo: true } }) : [],
    emails.length > 0 ? prisma.employee.findMany({ where: { email: { in: emails } }, select: { email: true } }) : [],
    cuils.length > 0 ? prisma.employee.findMany({ where: { cuil: { in: cuils } }, select: { cuil: true } }) : [],
    emails.length > 0 ? prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }) : [],
  ])
  const existingLegajos = new Set(empByLegajo.map(e => e.legajo))
  const existingEmails = new Set([...empByEmail.map(e => e.email), ...userByEmail.map(u => u.email)])
  const existingCuils = new Set(empByCuil.map(e => e.cuil))

  // Detectar duplicados dentro de la planilla misma
  const dupLegajo = new Map<string, number[]>()
  const dupEmail = new Map<string, number[]>()
  const dupCuil = new Map<string, number[]>()
  for (const p of parsed) {
    if (p.legajo) (dupLegajo.get(p.legajo) ?? dupLegajo.set(p.legajo, []).get(p.legajo)!).push(p.rowNum)
    if (p.email) (dupEmail.get(p.email) ?? dupEmail.set(p.email, []).get(p.email)!).push(p.rowNum)
    if (p.cuil) (dupCuil.get(p.cuil) ?? dupCuil.set(p.cuil, []).get(p.cuil)!).push(p.rowNum)
  }

  const existing: ExistingRow[] = []
  const invalid: RowError[] = []
  const validForCreation: ParsedRow[] = []

  for (const p of parsed) {
    const matches: string[] = []
    if (p.legajo && existingLegajos.has(p.legajo)) matches.push('legajo')
    if (p.email && existingEmails.has(p.email)) matches.push('email')
    if (p.cuil && existingCuils.has(p.cuil)) matches.push('cuil')

    // Duplicados dentro de la planilla (mismo valor en múltiples filas)
    const dupIntra: string[] = []
    if (p.legajo && (dupLegajo.get(p.legajo)?.length ?? 0) > 1) dupIntra.push(`legajo repetido en la planilla (filas ${dupLegajo.get(p.legajo)!.join(', ')})`)
    if (p.email && (dupEmail.get(p.email)?.length ?? 0) > 1) dupIntra.push(`email repetido en la planilla (filas ${dupEmail.get(p.email)!.join(', ')})`)
    if (p.cuil && (dupCuil.get(p.cuil)?.length ?? 0) > 1) dupIntra.push(`cuil repetido en la planilla (filas ${dupCuil.get(p.cuil)!.join(', ')})`)

    const allErrors = [...p.rowErrors, ...dupIntra]

    if (matches.length > 0) {
      existing.push({ row: p.rowNum, legajo: p.legajo, email: p.email, cuil: p.cuil, matches })
      continue
    }
    if (allErrors.length > 0) {
      invalid.push({ row: p.rowNum, email: p.email || undefined, error: allErrors.join(' · ') })
      continue
    }
    validForCreation.push(p)
  }

  if (preview) {
    return NextResponse.json({
      preview: true,
      total: rows.length,
      willCreate: validForCreation.length,
      existing,
      invalid,
      missingCategorias,
      missingAreas,
      categoriasCreadas: createMissingCategorias ? missingCategorias : [],
      areasCreadas: createMissingAreas ? missingAreas : [],
    })
  }

  // Import real
  const errors: RowError[] = [...invalid]
  let created = 0
  const skippedExisting: ExistingRow[] = []
  const categoriasCreadas = createMissingCategorias ? missingCategorias : []
  const areasCreadas = createMissingAreas ? missingAreas : []

  for (const p of parsed) {
    const matches: string[] = []
    if (p.legajo && existingLegajos.has(p.legajo)) matches.push('legajo')
    if (p.email && existingEmails.has(p.email)) matches.push('email')
    if (p.cuil && existingCuils.has(p.cuil)) matches.push('cuil')

    if (matches.length > 0) {
      if (skipExisting) {
        skippedExisting.push({ row: p.rowNum, legajo: p.legajo, email: p.email, cuil: p.cuil, matches })
        continue
      }
      errors.push({
        row: p.rowNum,
        email: p.email || undefined,
        error: `Ya existe un empleado con ese ${matches.join(', ')}`,
      })
      continue
    }
    if (p.rowErrors.length > 0) continue // ya incluido en errors

    try {
      const passwordHash = await hashPassword(p.password)
      await prisma.$transaction(async tx => {
        const emp = await tx.employee.create({
          data: {
            legajo: p.legajo, nombre: p.nombre, apellido: p.apellido, cuil: p.cuil, email: p.email,
            telefono: p.telefono, fechaIngreso: p.fechaIngreso!,
            areaId: areaByName.get(p.area.toLowerCase())!,
            categoriaId: catByName.get(p.categoria.toLowerCase())!,
            puesto: p.puesto, estado: 'ACTIVO',
          },
        })
        await tx.user.create({
          data: {
            email: p.email, username: p.username, passwordHash, role: 'EMPLOYEE', employeeId: emp.id,
          },
        })
      })
      created++
    } catch (e: any) {
      const code = e?.code
      if (code === 'P2002') errors.push({ row: p.rowNum, email: p.email || undefined, error: 'Legajo, CUIL o email ya existente' })
      else errors.push({ row: p.rowNum, email: p.email || undefined, error: e?.message ?? 'Error desconocido' })
    }
  }

  await logAction(user.userId, 'IMPORTAR_EMPLEADOS', 'Empleado', `${created} creados · ${errors.length} errores${skippedExisting.length ? ` · ${skippedExisting.length} omitidos por existir` : ''}${categoriasCreadas.length ? ` · ${categoriasCreadas.length} categorías creadas` : ''}${areasCreadas.length ? ` · ${areasCreadas.length} áreas creadas` : ''}`)
  return NextResponse.json({ created, errors, total: rows.length, categoriasCreadas, areasCreadas, skippedExisting })
}
