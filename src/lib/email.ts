import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return transporter
}

interface SendMailArgs {
  to: string
  subject: string
  title: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
}

export async function sendMail({ to, subject, title, bodyHtml, ctaLabel, ctaUrl }: SendMailArgs) {
  const t = getTransporter()
  if (!t) {
    console.warn('[email] SMTP no configurado, skip envío a', to)
    return
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const cta = ctaLabel && ctaUrl
    ? `<div style="margin:24px 0;text-align:center"><a href="${ctaUrl}" style="background:#166534;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">${ctaLabel}</a></div>`
    : ''
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5">
    <h1 style="margin:0 0 16px;font-size:20px;color:#166534">${title}</h1>
    <div style="font-size:14px;line-height:1.6;color:#333">${bodyHtml}</div>
    ${cta}
    <hr style="border:0;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#888;margin:0">
      Enviado por el sistema de RRHH · <a href="${appUrl}" style="color:#166534">${appUrl}</a>
    </p>
  </div>
</body>
</html>`

  try {
    await t.sendMail({ from, to, subject, html })
  } catch (e) {
    console.error(`[email] fallo enviando a ${to}:`, (e as Error).message)
  }
}
