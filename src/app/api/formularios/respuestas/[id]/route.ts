import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { updateAditusFileMetadata } from '@/lib/aditus'
import { formularioProps, parseArchivoRef } from '@/lib/aditusSolicitudes'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const decoded = await verifyToken(token)

  const { id } = await params
  const { datos } = await req.json()

  const respuesta = await prisma.respuestaFormulario.findUnique({
    where: { id: Number(id) },
    include: { asignacion: { select: { fechaLimite: true } } },
  })
  if (!respuesta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (!decoded.employeeId || respuesta.employeeId !== decoded.employeeId) {
    return NextResponse.json({ error: 'Solo el empleado dueño puede responder este formulario' }, { status: 403 })
  }

  if (respuesta.estado === 'PENDIENTE' && respuesta.asignacion.fechaLimite && respuesta.asignacion.fechaLimite < new Date()) {
    return NextResponse.json({ error: 'La fecha límite del formulario ya venció. Contactá al administrador para extenderla.' }, { status: 400 })
  }

  const updated = await prisma.respuestaFormulario.update({
    where: { id: Number(id) },
    data: { datos: JSON.stringify(datos), estado: 'ENVIADO' },
  })

  ;(async () => {
    try {
      const [full, admins] = await Promise.all([
        prisma.respuestaFormulario.findUnique({
          where: { id: Number(id) },
          select: {
            employee: { select: { nombre: true, apellido: true, legajo: true } },
            asignacion: { select: { nombre: true } },
          },
        }),
        prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
      ])
      if (!full || admins.length === 0) return
      const vars = {
        apellido: full.employee.apellido,
        nombre: full.employee.nombre,
        legajo: full.employee.legajo,
        formulario: full.asignacion.nombre,
      }
      await Promise.all(admins.map(a => sendMailFromTemplate('FORMULARIO_COMPLETADO', {
        to: a.email, vars,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/solicitudes?tab=formularios`,
      })))
    } catch (e) { console.error('[email/formulario-completado] fallo:', e) }
  })()

  // Actualizar detalles en Aditus de cada archivo adjunto en la respuesta (best-effort)
  ;(async () => {
    try {
      const full = await prisma.respuestaFormulario.findUnique({
        where: { id: Number(id) },
        include: {
          employee: { select: { legajo: true, cuil: true } },
          asignacion: {
            select: {
              nombre: true,
              plantilla: { select: { campos: { where: { tipo: 'archivo' }, select: { nombre: true } } } },
            },
          },
        },
      })
      if (!full?.employee) return
      const camposArchivo = new Set(full.asignacion.plantilla.campos.map(c => c.nombre))
      if (camposArchivo.size === 0) return
      const datosObj = JSON.parse(full.datos) as Record<string, unknown>
      const fecha = new Date().toLocaleDateString('es-AR')
      const detalles = `Respuesta ENVIADA el ${fecha} — Formulario: ${full.asignacion.nombre}`
      for (const [k, v] of Object.entries(datosObj)) {
        if (!camposArchivo.has(k) || typeof v !== 'string' || !v) continue
        const { aditusId, nombre } = parseArchivoRef(v)
        if (!aditusId) continue
        updateAditusFileMetadata(aditusId, formularioProps({
          empleado: { legajo: full.employee.legajo, cuil: full.employee.cuil },
          plantillaNombre: full.asignacion.nombre,
          fileName: nombre,
          detalles,
        })).catch(e => console.error('[aditus/formulario-enviado] update metadata fail:', e))
      }
    } catch (e) { console.error('[aditus/formulario-enviado] fallo:', e) }
  })()

  return NextResponse.json(updated)
}
