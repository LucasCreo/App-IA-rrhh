import 'dotenv/config'
import nodemailer from 'nodemailer'

const to = process.argv[2] ?? 'lcreo@grupolpa.com'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

console.log('Verificando conexión SMTP…')
try {
  await transporter.verify()
  console.log('✓ Conexión OK')
} catch (e) {
  console.error('✗ Falló verify:', e)
  process.exit(1)
}

console.log(`Enviando mail de prueba a ${to}…`)
try {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: 'Prueba SMTP — RRHH',
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px;margin:auto;border:1px solid #ddd;border-radius:8px">
        <h2 style="color:#166534">Prueba de envío</h2>
        <p>Este mail confirma que el SMTP de la app RRHH está funcionando correctamente.</p>
        <p style="color:#888;font-size:12px">Enviado desde ${process.env.SMTP_USER} vía ${process.env.SMTP_HOST}</p>
      </div>
    `,
  })
  console.log('✓ Enviado — messageId:', info.messageId)
  console.log('  response:', info.response)
} catch (e) {
  console.error('✗ Falló envío:', e)
  process.exit(1)
}
