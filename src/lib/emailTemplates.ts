import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/email'

export type EmailTemplateKey =
  | 'PASSWORD_RESET'
  | 'AUSENCIA_RESUELTA'
  | 'AUSENCIA_NUEVA'
  | 'SOLICITUD_NUEVA'
  | 'MODIFICACION_NUEVA'
  | 'DOCUMENTO_A_FIRMA'
  | 'POST_NUEVO'
  | 'FORMULARIO_ASIGNADO'
  | 'EVALUACION_ASIGNADA'
  | 'EMAIL_CAMBIADO'
  | 'SOLICITUD_DOC_RESUELTA'
  | 'MODIFICACION_REVISADA'
  | 'EMPLEADO_BIENVENIDA'
  | 'EMPLEADO_ESTADO_CAMBIADO'
  | 'COMENTARIO_RESPONDIDO'
  | 'RECIBO_FIRMADO'
  | 'FORMULARIO_COMPLETADO'
  | 'COMENTARIO_NUEVO_EN_POST'
  | 'INVITACION_USUARIO'

interface TemplateDef {
  label: string
  description: string
  subject: string
  title: string
  bodyHtml: string
  ctaLabel?: string
  variables: Array<{ name: string; description: string }>
}

export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, TemplateDef> = {
  PASSWORD_RESET: {
    label: 'Recuperación de contraseña',
    description: 'Se envía al usuario cuando pide restablecer su contraseña.',
    subject: 'Recuperar contraseña — RRHH',
    title: 'Recuperar tu contraseña',
    bodyHtml: `<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
<p>El link es válido por 1 hora. Si no fuiste vos, ignorá este mail.</p>`,
    ctaLabel: 'Restablecer contraseña',
    variables: [],
  },
  AUSENCIA_RESUELTA: {
    label: 'Ausencia resuelta',
    description: 'Se envía al empleado cuando el admin aprueba o rechaza su solicitud de ausencia.',
    subject: 'Solicitud de ausencia {{resultado}}',
    title: 'Tu solicitud de ausencia fue {{resultado}}',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Tu solicitud de <strong>{{tipoAusencia}}</strong> para el período <strong>{{rango}}</strong> fue <strong>{{resultado}}</strong>.</p>
{{bloqueComentario}}`,
    ctaLabel: 'Ver en el portal',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'tipoAusencia', description: 'Tipo de ausencia (Vacaciones, Enfermedad, etc.)' },
      { name: 'rango', description: 'Fechas del período (DD/MM/YYYY — DD/MM/YYYY)' },
      { name: 'resultado', description: '"aprobada" o "rechazada"' },
      { name: 'bloqueComentario', description: 'Bloque HTML con comentario del admin (vacío si no hay)' },
    ],
  },
  AUSENCIA_NUEVA: {
    label: 'Nueva solicitud de ausencia',
    description: 'Se envía a los administradores cuando un empleado solicita una ausencia.',
    subject: 'Nueva solicitud de ausencia — {{apellido}}, {{nombre}}',
    title: 'Nueva solicitud de ausencia pendiente',
    bodyHtml: `<p><strong>{{apellido}}, {{nombre}}</strong> (legajo {{legajo}}) solicita una ausencia:</p>
<ul>
  <li><strong>Tipo:</strong> {{tipoAusencia}}</li>
  <li><strong>Período:</strong> {{rango}} ({{dias}} días hábiles)</li>
  {{bloqueMotivo}}
</ul>`,
    ctaLabel: 'Revisar solicitud',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'apellido', description: 'Apellido del empleado' },
      { name: 'legajo', description: 'Legajo del empleado' },
      { name: 'tipoAusencia', description: 'Tipo de ausencia' },
      { name: 'rango', description: 'Fechas del período' },
      { name: 'dias', description: 'Cantidad de días hábiles' },
      { name: 'bloqueMotivo', description: 'Item <li> con el motivo (vacío si no hay)' },
    ],
  },
  SOLICITUD_NUEVA: {
    label: 'Nueva solicitud de documento',
    description: 'Se envía a los administradores cuando un empleado pide un documento.',
    subject: 'Solicitud de documento — {{apellido}}, {{nombre}}',
    title: 'Nueva solicitud de documento',
    bodyHtml: `<p><strong>{{apellido}}, {{nombre}}</strong> (legajo {{legajo}}) solicita:</p>
<ul>
  <li><strong>Tipo:</strong> {{tipo}}</li>
  {{bloqueDescripcion}}
</ul>`,
    ctaLabel: 'Ver solicitudes',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'apellido', description: 'Apellido del empleado' },
      { name: 'legajo', description: 'Legajo del empleado' },
      { name: 'tipo', description: 'Tipo de documento solicitado' },
      { name: 'bloqueDescripcion', description: 'Item <li> con detalle (vacío si no hay)' },
    ],
  },
  MODIFICACION_NUEVA: {
    label: 'Solicitud de modificación de datos',
    description: 'Se envía a los administradores cuando un empleado pide modificar sus datos personales.',
    subject: 'Solicitud de modificación de datos — {{apellido}}, {{nombre}}',
    title: 'Nueva solicitud de modificación de datos',
    bodyHtml: `<p><strong>{{apellido}}, {{nombre}}</strong> (legajo {{legajo}}) solicita modificar sus datos:</p>
<blockquote style="border-left:3px solid #ccc;margin:12px 0;padding:6px 12px;color:#444">{{comentario}}</blockquote>`,
    ctaLabel: 'Ver legajo',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'apellido', description: 'Apellido del empleado' },
      { name: 'legajo', description: 'Legajo del empleado' },
      { name: 'comentario', description: 'Comentario/pedido del empleado' },
    ],
  },
  DOCUMENTO_A_FIRMA: {
    label: 'Documento o recibo enviado a firma',
    description: 'Se envía al empleado cuando se le carga un documento o recibo para firmar/leer.',
    subject: 'Nuevo documento disponible: {{tipo}}',
    title: '{{titulo}}',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Se cargó un nuevo documento en tu portal: <strong>{{tipo}}</strong>{{bloquePeriodo}}.</p>
{{bloqueFirma}}`,
    ctaLabel: 'Ver en el portal',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'tipo', description: 'Tipo de documento' },
      { name: 'titulo', description: '"Tenés un documento pendiente de firma" o "Nuevo documento disponible"' },
      { name: 'bloquePeriodo', description: 'Texto con período entre paréntesis (vacío si no aplica)' },
      { name: 'bloqueFirma', description: 'Párrafo pidiendo firma (vacío si es solo lectura)' },
    ],
  },
  POST_NUEVO: {
    label: 'Nuevo aviso publicado',
    description: 'Se envía a los empleados cuando se publica un aviso nuevo en el portal.',
    subject: 'Nuevo aviso de {{autor}}',
    title: 'Nuevo aviso publicado',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p><strong>{{autor}}</strong> publicó un nuevo aviso:</p>
<blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;margin:12px 0;">{{preview}}</blockquote>`,
    ctaLabel: 'Ver aviso',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado destinatario' },
      { name: 'autor', description: 'Nombre de quien publicó el aviso' },
      { name: 'preview', description: 'Primeros 200 caracteres del aviso' },
    ],
  },
  FORMULARIO_ASIGNADO: {
    label: 'Formulario asignado',
    description: 'Se envía al empleado cuando se le asigna un formulario para completar.',
    subject: 'Nuevo formulario asignado: {{formulario}}',
    title: 'Tenés un formulario para completar',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Se te asignó un nuevo formulario: <strong>{{formulario}}</strong>.</p>
{{bloqueFecha}}`,
    ctaLabel: 'Completar formulario',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'formulario', description: 'Nombre del formulario' },
      { name: 'bloqueFecha', description: 'Párrafo con fecha límite (vacío si no tiene)' },
    ],
  },
  EVALUACION_ASIGNADA: {
    label: 'Evaluación asignada',
    description: 'Se envía al empleado cuando se lo incluye en una ronda de evaluación.',
    subject: 'Nueva evaluación: {{ronda}}',
    title: 'Tenés una nueva evaluación',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Fuiste incluido en una nueva ronda de evaluación: <strong>{{ronda}}</strong>.</p>
{{bloqueDescripcion}}
<p>Los resultados estarán disponibles en tu portal cuando el administrador los cargue.</p>`,
    ctaLabel: 'Ver mis evaluaciones',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'ronda', description: 'Nombre de la ronda' },
      { name: 'bloqueDescripcion', description: 'Párrafo con descripción (vacío si no hay)' },
    ],
  },
  EMAIL_CAMBIADO: {
    label: 'Cambio de email de acceso',
    description: 'Se envía tanto al email viejo como al nuevo cuando un admin cambia el email de un empleado.',
    subject: 'Tu email de acceso fue modificado',
    title: 'Cambio de email de acceso',
    bodyHtml: `Se modificó el email de acceso al portal de RRHH asociado a tu cuenta.<br/><br/>Nuevo email de acceso: <strong>{{emailNuevo}}</strong><br/>Email anterior: {{emailAnterior}}<br/><br/>Si vos no realizaste este cambio, contactá inmediatamente al administrador del sistema.`,
    variables: [
      { name: 'emailNuevo', description: 'Nuevo email de acceso' },
      { name: 'emailAnterior', description: 'Email anterior' },
    ],
  },
  SOLICITUD_DOC_RESUELTA: {
    label: 'Solicitud de documento resuelta',
    description: 'Se envía al empleado cuando el admin aprueba o rechaza su solicitud de documento.',
    subject: 'Solicitud de documento {{resultado}}',
    title: 'Tu solicitud de documento fue {{resultado}}',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Tu solicitud de <strong>{{tipo}}</strong> fue <strong>{{resultado}}</strong>.</p>
{{bloqueComentario}}`,
    ctaLabel: 'Ver en el portal',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'tipo', description: 'Tipo de documento solicitado' },
      { name: 'resultado', description: '"aprobada" o "rechazada"' },
      { name: 'bloqueComentario', description: 'Bloque HTML con comentario del admin (vacío si no hay o no es visible)' },
    ],
  },
  MODIFICACION_REVISADA: {
    label: 'Modificación de datos revisada',
    description: 'Se envía al empleado cuando el admin revisa su solicitud de modificación de datos.',
    subject: 'Tu solicitud de modificación fue revisada',
    title: 'Solicitud revisada',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>El administrador revisó tu solicitud de modificación de datos. Si aplicaron cambios, ya vas a poder verlos en tu perfil.</p>`,
    ctaLabel: 'Ver mi perfil',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
    ],
  },
  INVITACION_USUARIO: {
    label: 'Invitación para crear cuenta',
    description: 'Se envía al empleado para que cree su propia contraseña vía un link temporal (7 días).',
    subject: 'Te invitamos al portal de RRHH',
    title: '¡Bienvenido/a, {{nombre}}!',
    bodyHtml: `<p>Se creó tu cuenta en el portal de RRHH.</p>
<p>Hacé clic en el botón para elegir tu usuario y contraseña de acceso. El link vence el <strong>{{expira}}</strong>.</p>`,
    ctaLabel: 'Crear mi contraseña',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'expira', description: 'Fecha de vencimiento del link' },
    ],
  },
  EMPLEADO_BIENVENIDA: {
    label: 'Bienvenida al portal',
    description: 'Se envía al empleado cuando se lo da de alta con acceso al portal, incluyendo sus credenciales iniciales.',
    subject: 'Bienvenido/a al portal de RRHH',
    title: '¡Bienvenido/a, {{nombre}}!',
    bodyHtml: `<p>Se creó tu cuenta en el portal de RRHH. Con estas credenciales podés iniciar sesión:</p>
<ul>
  <li><strong>Email:</strong> {{email}}</li>
  <li><strong>Contraseña inicial:</strong> {{password}}</li>
</ul>
<p>Te recomendamos cambiarla la primera vez que ingreses desde tu perfil.</p>`,
    ctaLabel: 'Ir al portal',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'email', description: 'Email de acceso' },
      { name: 'password', description: 'Contraseña inicial (solo se muestra una vez)' },
    ],
  },
  EMPLEADO_ESTADO_CAMBIADO: {
    label: 'Cambio de estado (activo/inactivo)',
    description: 'Se envía al empleado cuando su estado cambia (por ejemplo, al ser dado de baja o reactivado).',
    subject: 'Tu cuenta fue {{estado}}',
    title: 'Cambio de estado en tu cuenta',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p>Tu cuenta en el portal fue marcada como <strong>{{estado}}</strong>. Si tenés dudas, contactá al administrador.</p>`,
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'estado', description: '"activada" o "desactivada"' },
    ],
  },
  COMENTARIO_RESPONDIDO: {
    label: 'Respuesta a tu comentario',
    description: 'Se envía a quien escribió un comentario cuando otra persona lo responde.',
    subject: '{{autor}} respondió tu comentario',
    title: 'Nueva respuesta a tu comentario',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p><strong>{{autor}}</strong> respondió tu comentario en el aviso <em>"{{postTitulo}}"</em>:</p>
<blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;margin:12px 0;">{{respuesta}}</blockquote>`,
    ctaLabel: 'Ver conversación',
    variables: [
      { name: 'nombre', description: 'Nombre del destinatario' },
      { name: 'autor', description: 'Nombre de quien respondió' },
      { name: 'postTitulo', description: 'Título del aviso' },
      { name: 'respuesta', description: 'Texto de la respuesta' },
    ],
  },
  RECIBO_FIRMADO: {
    label: 'Recibo/documento firmado por el empleado',
    description: 'Se envía a los administradores cuando un empleado firma o marca como leído un documento o recibo.',
    subject: 'Firmado: {{tipo}} — {{apellido}}, {{nombre}}',
    title: 'Documento firmado',
    bodyHtml: `<p><strong>{{apellido}}, {{nombre}}</strong> (legajo {{legajo}}) firmó/marcó como leído:</p>
<ul>
  <li><strong>Tipo:</strong> {{tipo}}</li>
  {{bloquePeriodo}}
  {{bloqueConformidad}}
</ul>
{{bloqueComentario}}`,
    ctaLabel: 'Ver documento',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'apellido', description: 'Apellido del empleado' },
      { name: 'legajo', description: 'Legajo del empleado' },
      { name: 'tipo', description: 'Tipo de documento' },
      { name: 'bloquePeriodo', description: 'Item <li> con período (vacío si no hay)' },
      { name: 'bloqueConformidad', description: 'Item <li> con "Conforme" o "No conforme" (vacío para documentos sin firma)' },
      { name: 'bloqueComentario', description: 'Blockquote con comentario del empleado (vacío si no hay)' },
    ],
  },
  FORMULARIO_COMPLETADO: {
    label: 'Formulario completado por el empleado',
    description: 'Se envía a los administradores cuando un empleado completa y envía un formulario asignado.',
    subject: 'Formulario completado: {{formulario}} — {{apellido}}, {{nombre}}',
    title: 'Formulario completado',
    bodyHtml: `<p><strong>{{apellido}}, {{nombre}}</strong> (legajo {{legajo}}) completó el formulario <strong>{{formulario}}</strong>.</p>`,
    ctaLabel: 'Ver respuestas',
    variables: [
      { name: 'nombre', description: 'Nombre del empleado' },
      { name: 'apellido', description: 'Apellido del empleado' },
      { name: 'legajo', description: 'Legajo del empleado' },
      { name: 'formulario', description: 'Nombre del formulario/asignación' },
    ],
  },
  COMENTARIO_NUEVO_EN_POST: {
    label: 'Nuevo comentario en tu aviso',
    description: 'Se envía al autor de un aviso cuando alguien deja un comentario en él.',
    subject: '{{autor}} comentó tu aviso',
    title: 'Nuevo comentario en tu aviso',
    bodyHtml: `<p>Hola {{nombre}},</p>
<p><strong>{{autor}}</strong> dejó un comentario en tu aviso <em>"{{postTitulo}}"</em>:</p>
<blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;margin:12px 0;">{{comentario}}</blockquote>`,
    ctaLabel: 'Ver conversación',
    variables: [
      { name: 'nombre', description: 'Nombre del autor del aviso' },
      { name: 'autor', description: 'Nombre de quien comentó' },
      { name: 'postTitulo', description: 'Título del aviso' },
      { name: 'comentario', description: 'Texto del comentario' },
    ],
  },
}

function render(str: string, vars: Record<string, string | undefined>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

interface Resolved {
  subject: string
  title: string
  bodyHtml: string
  ctaLabel?: string
}

async function resolveTemplate(key: EmailTemplateKey): Promise<Resolved & { enabled: boolean }> {
  const def = DEFAULT_TEMPLATES[key]
  try {
    // Cast hasta que `prisma generate` corra con el nuevo modelo (requiere parar dev server en Windows)
    const custom = await (prisma as unknown as { emailTemplate: { findUnique: (args: { where: { key: string } }) => Promise<{ subject: string; title: string; bodyHtml: string; ctaLabel: string | null; enabled: boolean } | null> } }).emailTemplate.findUnique({ where: { key } })
    if (custom) {
      return {
        subject: custom.subject,
        title: custom.title,
        bodyHtml: custom.bodyHtml,
        ctaLabel: custom.ctaLabel ?? undefined,
        enabled: custom.enabled,
      }
    }
  } catch (e) {
    console.warn('[emailTemplates] fallback a default por error de DB:', e)
  }
  return { subject: def.subject, title: def.title, bodyHtml: def.bodyHtml, ctaLabel: def.ctaLabel, enabled: true }
}

export async function renderTemplate(key: EmailTemplateKey, vars: Record<string, string | undefined>): Promise<Resolved & { enabled: boolean }> {
  const t = await resolveTemplate(key)
  return {
    subject: render(t.subject, vars),
    title: render(t.title, vars),
    bodyHtml: render(t.bodyHtml, vars),
    ctaLabel: t.ctaLabel,
    enabled: t.enabled,
  }
}

interface SendArgs {
  to: string
  vars: Record<string, string | undefined>
  ctaUrl?: string
}

export async function sendMailFromTemplate(key: EmailTemplateKey, { to, vars, ctaUrl }: SendArgs) {
  const rendered = await renderTemplate(key, vars)
  if (!rendered.enabled) return
  return sendMail({
    to,
    subject: rendered.subject,
    title: rendered.title,
    bodyHtml: rendered.bodyHtml,
    ctaLabel: rendered.ctaLabel,
    ctaUrl,
  })
}
