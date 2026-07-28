import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso, getCurrentUser } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { DEFAULT_TEMPLATES, EmailTemplateKey, sendMailFromTemplate } from '@/lib/emailTemplates'

function isValidKey(k: string): k is EmailTemplateKey {
  return k in DEFAULT_TEMPLATES
}

// Variables de prueba por template
const SAMPLE: Record<EmailTemplateKey, Record<string, string>> = {
  PASSWORD_RESET: {},
  AUSENCIA_RESUELTA: {
    nombre: 'Juan',
    tipoAusencia: 'Vacaciones',
    rango: '01/08/2026 — 10/08/2026',
    resultado: 'aprobada',
    bloqueComentario: '<p><em>Comentario del administrador:</em> Buen viaje!</p>',
  },
  AUSENCIA_NUEVA: {
    apellido: 'García', nombre: 'Juan', legajo: '1234',
    tipoAusencia: 'Vacaciones', rango: '01/08/2026 — 10/08/2026', dias: '8',
    bloqueMotivo: '<li><strong>Motivo:</strong> Viaje familiar</li>',
  },
  SOLICITUD_NUEVA: {
    apellido: 'García', nombre: 'Juan', legajo: '1234',
    tipo: 'Certificado de trabajo',
    bloqueDescripcion: '<li><strong>Detalle:</strong> Para presentar en el banco</li>',
  },
  MODIFICACION_NUEVA: {
    apellido: 'García', nombre: 'Juan', legajo: '1234',
    comentario: 'Cambio de dirección: Nueva calle 123',
  },
  DOCUMENTO_A_FIRMA: {
    nombre: 'Juan',
    tipo: 'Recibo de sueldo',
    titulo: 'Tenés un documento pendiente de firma',
    bloquePeriodo: ' (2026-07)',
    bloqueFirma: '<p>Requiere tu firma para completarse.</p>',
  },
  POST_NUEVO: {
    nombre: 'Juan',
    autor: 'María López',
    preview: 'Se informa a todo el personal que el próximo lunes 15 de septiembre será feriado...',
  },
  FORMULARIO_ASIGNADO: {
    nombre: 'Juan',
    formulario: 'Evaluación anual 2026',
    bloqueFecha: '<p>Fecha límite: <strong>30/09/2026</strong>.</p>',
  },
  EVALUACION_ASIGNADA: {
    nombre: 'Juan',
    ronda: 'Evaluación semestral Q2',
    bloqueDescripcion: '<p>Recordá completarla antes del cierre del mes.</p>',
  },
  EMAIL_CAMBIADO: {
    emailNuevo: 'juan.nuevo@empresa.com',
    emailAnterior: 'juan.viejo@empresa.com',
  },
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { key } = await params
  if (!isValidKey(key)) return NextResponse.json({ error: 'Template desconocido' }, { status: 400 })

  const current = await getCurrentUser()
  const toEmail = current?.email
  if (!toEmail) return NextResponse.json({ error: 'Tu usuario no tiene email asociado' }, { status: 400 })

  try {
    await sendMailFromTemplate(key, {
      to: toEmail,
      vars: SAMPLE[key],
      ctaUrl: process.env.NEXT_PUBLIC_APP_URL ?? '#',
    })
    return NextResponse.json({ ok: true, sentTo: toEmail })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al enviar' }, { status: 500 })
  }
}
