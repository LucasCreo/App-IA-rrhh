import sanitizeHtml from 'sanitize-html'
import { unlink } from 'fs/promises'
import { join, basename } from 'path'
import { deleteAditusFile } from '@/lib/aditus'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'a', 'span',
  'img', 'audio', 'video', 'source',
  'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3',
]

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel', 'data-attachment', 'data-file-name', 'data-size', 'download', 'class'],
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
      a: (tagName, attribs) => {
        // Los attachment mantienen el atributo download; para el resto forzamos target y rel.
        const esAttachment = attribs['data-attachment'] === 'true'
        return {
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
            ...(esAttachment ? { class: 'portal-attachment' } : {}),
          },
        }
      },
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
 * Extrae rutas /uploads/posts/... referenciadas en HTML.
 * Cubre `src` (img/audio/video/source) y `href` (attachments).
 */
export function extraerRutasMedia(html: string): string[] {
  const rutas = new Set<string>()
  const re = /(?:src|href)=["'](\/uploads\/posts\/[^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) rutas.add(m[1])
  return [...rutas]
}

/** Prefijo que llevan los archivos subidos que además tienen espejo en Aditus. */
const ADITUS_PREFIX_RE = /^ADITUS_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})_/

/** Extrae el aditusId incrustado en el nombre de archivo (si lo tiene). */
export function aditusIdFromRuta(ruta: string): string | null {
  const name = basename(ruta)
  const m = ADITUS_PREFIX_RE.exec(name)
  return m ? m[1] : null
}

/**
 * Borra los archivos físicos y su espejo en Aditus (si existe). Best-effort:
 * cualquier fallo se logea pero no interrumpe la operación de negocio.
 */
export async function borrarMedia(rutas: string[]) {
  // Filesystem local
  const results = await Promise.allSettled(
    rutas.map(r => unlink(join(process.cwd(), 'public', r)))
  )
  const fallidos = results
    .map((r, i) => (r.status === 'rejected' ? rutas[i] : null))
    .filter((x): x is string => !!x)
  if (fallidos.length > 0) console.warn('[portal/media] no se pudo eliminar local:', fallidos)

  // Aditus (para los que tienen id embebido en el filename)
  const ids = rutas.map(aditusIdFromRuta).filter((x): x is string => !!x)
  if (ids.length > 0) {
    const r2 = await Promise.allSettled(ids.map(id => deleteAditusFile(id)))
    const fallidosAd = r2
      .map((r, i) => (r.status === 'rejected' ? ids[i] : null))
      .filter((x): x is string => !!x)
    if (fallidosAd.length > 0) console.warn('[portal/media] no se pudo eliminar de Aditus:', fallidosAd)
  }
}
