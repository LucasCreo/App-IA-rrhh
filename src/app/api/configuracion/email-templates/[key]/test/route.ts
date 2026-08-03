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
  SOLICITUD_DOC_RESUELTA: {
    nombre: 'Juan',
    tipo: 'Certificado de trabajo',
    resultado: 'aprobada',
    bloqueComentario: '<p><em>Comentario del administrador:</em> Ya te lo enviamos por mail aparte.</p>',
  },
  MODIFICACION_REVISADA: {
    nombre: 'Juan',
  },
  EMPLEADO_BIENVENIDA: {
    nombre: 'Juan',
    email: 'juan@empresa.com',
    password: 'ContrasenaTemporal123',
  },
  EMPLEADO_ESTADO_CAMBIADO: {
    nombre: 'Juan',
    estado: 'desactivada',
  },
  COMENTARIO_RESPONDIDO: {
    nombre: 'Juan',
    autor: 'María López',
    postTitulo: 'Feriado del 15/09',
    respuesta: '¡Gracias por el aviso! Confirmo que lo tomo.',
  },
  RECIBO_FIRMADO: {
    apellido: 'García', nombre: 'Juan', legajo: '1234',
    tipo: 'Recibo de sueldo',
    bloquePeriodo: '<li><strong>Período:</strong> 2026-07</li>',
    bloqueConformidad: '<li><strong>Firma:</strong> Conforme</li>',
    bloqueComentario: '<blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;margin:12px 0;">Todo correcto, gracias.</blockquote>',
  },
  FORMULARIO_COMPLETADO: {
    apellido: 'García', nombre: 'Juan', legajo: '1234',
    formulario: 'Evaluación anual 2026',
  },
  COMENTARIO_NUEVO_EN_POST: {
    nombre: 'Juan',
    autor: 'María López',
    postTitulo: 'Feriado del 15/09',
    comentario: 'Recuerden que ese día también cierra el comedor.',
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
