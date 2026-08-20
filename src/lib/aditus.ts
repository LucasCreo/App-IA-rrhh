/**
 * Cliente para la plataforma Aditus (autenticación OIDC via Keycloak).
 * Cachea el access_token en memoria y lo refresca antes de vencer.
 */

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_expires_in?: number
  refresh_token?: string
  token_type?: string
}

interface CachedToken {
  accessToken: string
  expiresAt: number // epoch ms
}

let cache: CachedToken | null = null
let inflight: Promise<CachedToken> | null = null

// Refrescamos 30s antes de la expiración real para evitar carreras con el reloj.
const SKEW_MS = 30_000

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta variable de entorno ${name}`)
  return v
}

async function requestToken(): Promise<CachedToken> {
  const url = envOrThrow('ADITUS_TOKEN_URL')
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: envOrThrow('ADITUS_CLIENT_ID'),
    username: envOrThrow('ADITUS_USERNAME'),
    password: envOrThrow('ADITUS_PASSWORD'),
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    // Aditus vive en la red interna, no queremos que se cachee ni se reintente
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Aditus token request failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }

  const data = (await res.json()) as TokenResponse
  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error('Aditus token response inválido (falta access_token o expires_in)')
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

/**
 * Devuelve un access_token válido. Cachea en memoria y refresca automáticamente.
 * Coalescea llamadas concurrentes: si ya hay un request en vuelo, se comparte.
 */
export async function getAditusToken(): Promise<string> {
  const now = Date.now()
  if (cache && cache.expiresAt - SKEW_MS > now) {
    return cache.accessToken
  }
  if (inflight) {
    const t = await inflight
    return t.accessToken
  }
  inflight = requestToken()
    .then(t => { cache = t; return t })
    .finally(() => { inflight = null })
  const t = await inflight
  return t.accessToken
}

/** Info del token cacheado (útil para diagnóstico, no expone el token). */
export function getAditusTokenInfo(): { cached: boolean; expiresAt: string | null; expiresInSec: number | null } {
  if (!cache) return { cached: false, expiresAt: null, expiresInSec: null }
  return {
    cached: true,
    expiresAt: new Date(cache.expiresAt).toISOString(),
    expiresInSec: Math.max(0, Math.round((cache.expiresAt - Date.now()) / 1000)),
  }
}

/** Fuerza el refresh del token (invalida cache). Útil si el server retorna 401. */
export function invalidateAditusToken() {
  cache = null
}

// ── Upload de archivos ──────────────────────────────────────────────────────

export interface AditusUploadProperties {
  /** Nombre del objeto en la plataforma (visible como título). */
  objectTitle: string
  /** Legajo del empleado, si aplica. */
  legajo?: string
  /** CUIL del empleado, si aplica. */
  cuil?: string
  /** Tipo de documento (recibo, formulario, foto perfil, etc.). */
  tipoDocumento?: string
  /** Texto libre (máx 5000 chars). Útil para notas, lista de legajos, contexto, etc. */
  detalles?: string
}

export interface AditusUploadInput {
  /** Contenido del archivo. Se convierte a base64 raw. */
  content: Buffer
  /** Nombre del archivo con extensión. */
  fileName: string
  /** MIME type (ej: application/pdf, image/png). */
  contentType: string
  properties: AditusUploadProperties
}

function baseUrl(): string {
  return envOrThrow('ADITUS_BASE_URL').replace(/\/+$/, '')
}

function libraryHeader(): string {
  return envOrThrow('ADITUS_LIBRARY_ID')
}

function objectDefinitionId(): string {
  return envOrThrow('ADITUS_OBJECT_DEFINITION_ID')
}

function buildProperties(p: AditusUploadProperties): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [
    { name: 'object_title', value: p.objectTitle },
  ]
  if (p.legajo) out.push({ name: 'legajo', value: p.legajo })
  if (p.cuil) out.push({ name: 'cuil', value: p.cuil })
  if (p.tipoDocumento) out.push({ name: 'tipo_de_documento', value: p.tipoDocumento })
  if (p.detalles) out.push({ name: 'detalles', value: p.detalles.slice(0, 5000) })
  return out
}

function buildUploadBody(input: AditusUploadInput) {
  return {
    json: {
      properties: buildProperties(input.properties),
      security: [],
      objectDefinitionId: objectDefinitionId(),
    },
    content: input.content.toString('base64'),
    fileName: input.fileName,
    contentType: input.contentType,
  }
}

async function doUpload(input: AditusUploadInput, token: string): Promise<Response> {
  const url = `${baseUrl()}/documents/base64?disableSubscription=true`
  return fetch(url, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'x-library': libraryHeader(),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildUploadBody(input)),
    cache: 'no-store',
  })
}

async function doUpdate(id: string, input: AditusUploadInput, token: string): Promise<Response> {
  const url = `${baseUrl()}/documents/${encodeURIComponent(id)}/base64?disableSubscription=true`
  return fetch(url, {
    method: 'PUT',
    headers: {
      'accept': '*/*',
      'x-library': libraryHeader(),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildUploadBody(input)),
    cache: 'no-store',
  })
}

/**
 * Sube un archivo a Aditus y devuelve el ID del documento creado.
 * Reintenta una vez si el token está vencido (401).
 */
export async function uploadAditusFile(input: AditusUploadInput): Promise<string> {
  let token = await getAditusToken()
  let res = await doUpload(input, token)

  if (res.status === 401) {
    invalidateAditusToken()
    token = await getAditusToken()
    res = await doUpload(input, token)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Aditus upload failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }

  const raw = (await res.text()).trim()
  if (!raw) throw new Error('Aditus upload devolvió id vacío')
  // Aditus puede devolver el id crudo o entrecomillado ("uuid"). Sacamos comillas envolventes.
  const id = raw.replace(/^"|"$/g, '').trim()
  if (!id) throw new Error('Aditus upload devolvió id vacío tras normalizar')
  return id
}

/**
 * Modifica (reemplaza contenido + metadata) un archivo ya subido a Aditus.
 * Reintenta una vez si el token está vencido (401).
 */
export async function updateAditusFile(id: string, input: AditusUploadInput): Promise<void> {
  if (!id) throw new Error('id requerido para actualizar en Aditus')
  let token = await getAditusToken()
  let res = await doUpdate(id, input, token)

  if (res.status === 401) {
    invalidateAditusToken()
    token = await getAditusToken()
    res = await doUpdate(id, input, token)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Aditus update failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }
}

async function doGet(id: string, token: string, download = false): Promise<Response> {
  const url = `${baseUrl()}/documents/${encodeURIComponent(id)}${download ? '/download' : ''}`
  return fetch(url, {
    method: 'GET',
    headers: {
      'accept': '*/*',
      'x-library': libraryHeader(),
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store',
  })
}

export interface AditusFile {
  content: Buffer
  contentType: string
  fileName?: string
}

/**
 * Obtiene un archivo de Aditus. Por defecto usa el endpoint de preview.
 * Pasá { download: true } para el endpoint de descarga (/download).
 * Reintenta una vez si el token está vencido (401).
 */
export async function getAditusFile(id: string, opts?: { download?: boolean }): Promise<AditusFile> {
  if (!id) throw new Error('id requerido para descargar de Aditus')
  const download = opts?.download === true
  let token = await getAditusToken()
  let res = await doGet(id, token, download)

  if (res.status === 401) {
    invalidateAditusToken()
    token = await getAditusToken()
    res = await doGet(id, token, download)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Aditus get failed: HTTP ${res.status} para id="${id}"${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const disp = res.headers.get('content-disposition') || ''
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp)
  const fileName = m ? decodeURIComponent(m[1]) : undefined
  const buf = Buffer.from(await res.arrayBuffer())
  return { content: buf, contentType, fileName }
}

async function doDelete(id: string, token: string): Promise<Response> {
  const url = `${baseUrl()}/documents/${encodeURIComponent(id)}`
  return fetch(url, {
    method: 'DELETE',
    headers: {
      'accept': '*/*',
      'x-library': libraryHeader(),
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store',
  })
}

/**
 * Elimina un archivo de Aditus por id.
 * Reintenta una vez si el token está vencido (401).
 */
export async function deleteAditusFile(id: string): Promise<void> {
  if (!id) throw new Error('id requerido para eliminar en Aditus')
  let token = await getAditusToken()
  let res = await doDelete(id, token)

  if (res.status === 401) {
    invalidateAditusToken()
    token = await getAditusToken()
    res = await doDelete(id, token)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Aditus delete failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }
}
