import sanitizeHtml from 'sanitize-html'
import { unlink } from 'fs/promises'
import { join } from 'path'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'a', 'span',
  'img', 'audio', 'video', 'source',
  'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3',
]

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  audio: ['src', 'controls'],
  video: ['src', 'controls', 'width', 'height', 'poster'],
  source: ['src', 'type'],
  span: ['data-mention', 'data-id', 'class'],
}

/**
 * Sanitiza HTML del editor: solo tags/atributos de la whitelist, URLs de media
 * restringidas a /uploads/posts/, y links con `rel="noopener noreferrer"`.
 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      audio: ['http', 'https'],
      video: ['http', 'https'],
      source: ['http', 'https'],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  })
}

/**
 * Detecta si el string contiene HTML (tags). Los posts viejos son texto plano.
 */
export function esHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s)
}

/**
 * Extrae rutas /uploads/posts/... referenciadas en HTML (src en img/audio/video/source).
 */
export function extraerRutasMedia(html: string): string[] {
  const rutas: string[] = []
  const re = /src=["'](\/uploads\/posts\/[^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) rutas.push(m[1])
  return rutas
}

/**
 * Borra los archivos físicos referenciados por rutas /uploads/posts/... best-effort.
 */
export async function borrarMedia(rutas: string[]) {
  const results = await Promise.allSettled(
    rutas.map(r => unlink(join(process.cwd(), 'public', r)))
  )
  const fallidos = results
    .map((r, i) => (r.status === 'rejected' ? rutas[i] : null))
    .filter((x): x is string => !!x)
  if (fallidos.length > 0) {
    console.warn('[portal/media] no se pudo eliminar:', fallidos)
  }
}
