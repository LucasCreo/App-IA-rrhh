import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function envVal(k: string) {
  const v = process.env[k]
  return v && v.trim() ? v.trim() : null
}

export function getTransporter() {
  if (transporter) return transporter
  const host = envVal('SMTP_HOST')
  const port = Number(envVal('SMTP_PORT') ?? '587')
  const user = envVal('SMTP_USER')
  const pass = envVal('SMTP_PASS')
  if (!host || !user || !pass) return null
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return transporter
}

export function smtpDiagnostics() {
  return {
    SMTP_HOST: !!envVal('SMTP_HOST'),
    SMTP_PORT: envVal('SMTP_PORT') ?? '(default 587)',
    SMTP_USER: !!envVal('SMTP_USER'),
    SMTP_PASS: !!envVal('SMTP_PASS'),
    SMTP_FROM: !!envVal('SMTP_FROM'),
  }
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
    const missing = Object.entries(smtpDiagnostics())
      .filter(([k, v]) => (k === 'SMTP_HOST' || k === 'SMTP_USER' || k === 'SMTP_PASS') && v === false)
      .map(([k]) => k)
    const msg = `SMTP no configurado (faltan/vacías: ${missing.join(', ')})`
    console.warn('[email]', msg, '— skip envío a', to)
    throw new Error(msg)
  }
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER
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
    const msg = (e as Error).message
    console.error(`[email] fallo enviando a ${to}:`, msg)
    throw new Error(msg)
  }
}
