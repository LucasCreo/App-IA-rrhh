import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { DEFAULT_TEMPLATES, EmailTemplateKey } from '@/lib/emailTemplates'

const db = prisma as unknown as {
  emailTemplate: {
    upsert: (args: {
      where: { key: string }
      update: { subject: string; title: string; bodyHtml: string; ctaLabel: string | null; enabled: boolean }
      create: { key: string; subject: string; title: string; bodyHtml: string; ctaLabel: string | null; enabled: boolean }
    }) => Promise<unknown>
    delete: (args: { where: { key: string } }) => Promise<unknown>
  }
}

function isValidKey(k: string): k is EmailTemplateKey {
  return k in DEFAULT_TEMPLATES
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { key } = await params
  if (!isValidKey(key)) return NextResponse.json({ error: 'Template desconocido' }, { status: 400 })

  const body = await req.json()
  const subject = String(body.subject ?? '').trim()
  const title = String(body.title ?? '').trim()
  const bodyHtml = String(body.bodyHtml ?? '').trim()
  const ctaLabel = body.ctaLabel ? String(body.ctaLabel).trim() : null
  const enabled = body.enabled !== false

  if (!subject || !title || !bodyHtml) {
    return NextResponse.json({ error: 'Asunto, título y cuerpo son requeridos' }, { status: 400 })
  }

  await db.emailTemplate.upsert({
    where: { key },
    update: { subject, title, bodyHtml, ctaLabel, enabled },
    create: { key, subject, title, bodyHtml, ctaLabel, enabled },
  })

  await logAction(user.userId, 'EDITAR', 'EmailTemplate', key)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { key } = await params
  if (!isValidKey(key)) return NextResponse.json({ error: 'Template desconocido' }, { status: 400 })

  try {
    await db.emailTemplate.delete({ where: { key } })
  } catch {
    // ya estaba en default (sin fila), no-op
  }
  await logAction(user.userId, 'RESTAURAR', 'EmailTemplate', key)
  return NextResponse.json({ ok: true })
}
