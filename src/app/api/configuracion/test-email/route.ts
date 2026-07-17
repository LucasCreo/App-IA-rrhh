import { NextRequest, NextResponse } from 'next/server'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { to } = await req.json()
  const dest = to?.trim() || user.email
  if (!dest) return NextResponse.json({ error: 'Destinatario requerido' }, { status: 400 })

  try {
    await sendMail({
      to: dest,
      subject: 'Test de configuración SMTP',
      title: '✅ SMTP configurado correctamente',
      bodyHtml: `
        <p>Este es un email de prueba enviado desde el panel de configuración.</p>
        <p>Si lo recibiste, el envío de emails está funcionando.</p>
      `,
    })
    return NextResponse.json({ ok: true, sentTo: dest })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error al enviar el email' }, { status: 500 })
  }
}
