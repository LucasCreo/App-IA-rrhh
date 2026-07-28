import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { DEFAULT_TEMPLATES, EmailTemplateKey } from '@/lib/emailTemplates'

type EmailTemplateRow = {
  key: string
  subject: string
  title: string
  bodyHtml: string
  ctaLabel: string | null
  enabled: boolean
  updatedAt: Date
}

const db = prisma as unknown as {
  emailTemplate: {
    findMany: () => Promise<EmailTemplateRow[]>
  }
}

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const rows = await db.emailTemplate.findMany()
  const byKey = new Map(rows.map(r => [r.key, r]))

  const items = (Object.keys(DEFAULT_TEMPLATES) as EmailTemplateKey[]).map(key => {
    const def = DEFAULT_TEMPLATES[key]
    const row = byKey.get(key)
    return {
      key,
      label: def.label,
      description: def.description,
      variables: def.variables,
      customized: !!row,
      enabled: row?.enabled ?? true,
      subject: row?.subject ?? def.subject,
      title: row?.title ?? def.title,
      bodyHtml: row?.bodyHtml ?? def.bodyHtml,
      ctaLabel: row?.ctaLabel ?? def.ctaLabel ?? null,
      default: {
        subject: def.subject,
        title: def.title,
        bodyHtml: def.bodyHtml,
        ctaLabel: def.ctaLabel ?? null,
      },
    }
  })

  return NextResponse.json(items)
}
