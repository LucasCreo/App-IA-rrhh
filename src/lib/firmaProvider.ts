import { getAditusFile } from './aditus'

export interface FirmaContext {
  documentId: number
  documentUrl?: string
  empleado: { legajo: string; cuil: string; nombre: string; apellido: string; email: string }
  lote?: { nombre: string; periodo: string } | null
  apiKey?: string | null
  apiSecret?: string | null
  aditusId?: string | null
}

const KEY_MAP: Record<string, (ctx: FirmaContext, fileBase64?: string) => string> = {
  'documentId':       ctx => String(ctx.documentId),
  'documentUrl':      ctx => ctx.documentUrl ?? '',
  'fileBase64':       (_c, b) => b ?? '',
  'empleado.legajo':  ctx => ctx.empleado.legajo,
  'empleado.cuil':    ctx => ctx.empleado.cuil,
  'empleado.nombre':  ctx => ctx.empleado.nombre,
  'empleado.apellido':ctx => ctx.empleado.apellido,
  'empleado.email':   ctx => ctx.empleado.email,
  'lote.nombre':      ctx => ctx.lote?.nombre ?? '',
  'lote.periodo':     ctx => ctx.lote?.periodo ?? '',
  'apiKey':           ctx => ctx.apiKey ?? '',
  'apiSecret':        ctx => ctx.apiSecret ?? '',
}

/** Lista de placeholders soportados (para UI). */
export const FIRMA_PLACEHOLDERS = Object.keys(KEY_MAP)

/** Reemplaza {clave} por su valor en el contexto. Deja intacto lo desconocido. */
export function substitutePlaceholders(text: string, ctx: FirmaContext, fileBase64?: string): string {
  return text.replace(/\{([\w.]+)\}/g, (m, key) => {
    const fn = KEY_MAP[key]
    return fn ? fn(ctx, fileBase64) : m
  })
}

interface TipoFirmaConfig {
  firmaEndpoint: string | null
  firmaBody: string | null
  firmaHeaders: string | null
  firmaApiKey: string | null
  firmaApiSecret: string | null
}

export interface FirmaResult {
  ok: boolean
  status: number
  body: string
  url: string
}

/**
 * Ejecuta el POST al proveedor externo con los placeholders sustituidos.
 * Si el body/headers/url usan {fileBase64}, descarga el PDF desde Aditus primero.
 */
export async function sendToProvider(opts: { tipo: TipoFirmaConfig; ctx: FirmaContext }): Promise<FirmaResult> {
  const { tipo, ctx } = opts
  const url = tipo.firmaEndpoint ?? ''
  const rawBody = tipo.firmaBody ?? ''
  const rawHeaders = tipo.firmaHeaders ?? ''
  if (!url.trim()) throw new Error('El tipo no tiene URL (endpoint) configurada')

  const fullCtx: FirmaContext = { ...ctx, apiKey: tipo.firmaApiKey, apiSecret: tipo.firmaApiSecret }

  const needsFile = /\{fileBase64\}/.test(url + rawBody + rawHeaders)
  let fileBase64: string | undefined
  if (needsFile) {
    if (!ctx.aditusId) throw new Error('El documento no tiene aditusId — no se puede obtener el PDF')
    const file = await getAditusFile(ctx.aditusId, { download: true })
    fileBase64 = file.content.toString('base64')
  }

  const finalUrl  = substitutePlaceholders(url, fullCtx, fileBase64)
  const finalBody = substitutePlaceholders(rawBody, fullCtx, fileBase64)
  const finalHdrs = substitutePlaceholders(rawHeaders, fullCtx, fileBase64)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (finalHdrs.trim()) {
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(finalHdrs) }
    catch { throw new Error('firmaHeaders no es JSON válido tras sustitución') }
    for (const [k, v] of Object.entries(parsed)) headers[k] = String(v)
  }

  const res = await fetch(finalUrl, { method: 'POST', headers, body: finalBody || undefined })
  const respText = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, body: respText.slice(0, 2000), url: finalUrl }
}
