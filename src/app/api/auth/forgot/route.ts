import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/email'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  // Respondemos siempre OK aunque no exista el email (para no filtrar qué cuentas están registradas)
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: email.trim() }, { username: email.trim() }] },
    include: { employee: { select: { email: true } } },
  })

  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    const emailDestino = user.email || user.employee?.email
    if (emailDestino) {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      // Fire-and-forget: no bloqueamos la respuesta esperando al SMTP
      sendMail({
        to: emailDestino,
        subject: 'Recuperar contraseña — RRHH',
        title: 'Recuperar tu contraseña',
        bodyHtml: `
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>El link es válido por 1 hora. Si no fuiste vos, ignorá este mail.</p>
        `,
        ctaLabel: 'Restablecer contraseña',
        ctaUrl: resetUrl,
      }).catch(e => console.error('[email/forgot] fallo:', e))
    }
  }

  return NextResponse.json({ ok: true })
}
