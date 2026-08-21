// Validación de archivos por magic bytes (contenido real), no por extensión ni por el
// Content-Type del cliente (ambos falsificables).

export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'gif' | 'mp3' | 'wav' | 'mp4' | 'webm' | 'doc' | 'docx'

function match(buf: Buffer, offset: number, sig: number[]): boolean {
  if (buf.length < offset + sig.length) return false
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false
  return true
}

export function detectFileKind(buf: Buffer): FileKind | null {
  if (match(buf, 0, [0x25, 0x50, 0x44, 0x46])) return 'pdf'                        // %PDF
  if (match(buf, 0, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (match(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (match(buf, 0, [0x52, 0x49, 0x46, 0x46]) && match(buf, 8, [0x57, 0x45, 0x42, 0x50])) return 'webp'
  if (match(buf, 0, [0x52, 0x49, 0x46, 0x46]) && match(buf, 8, [0x57, 0x41, 0x56, 0x45])) return 'wav'
  if (match(buf, 0, [0x47, 0x49, 0x46, 0x38])) return 'gif'
  if (match(buf, 0, [0x49, 0x44, 0x33]) || match(buf, 0, [0xff, 0xfb]) || match(buf, 0, [0xff, 0xf3]) || match(buf, 0, [0xff, 0xf2])) return 'mp3'
  if (match(buf, 4, [0x66, 0x74, 0x79, 0x70])) return 'mp4'                        // ftyp
  if (match(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'                       // EBML
  // Word legacy (.doc) — OLE Compound File Binary
  if (match(buf, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'doc'
  // Word moderno (.docx) — ZIP (PK\x03\x04). Nota: cualquier .zip válido matchea acá; aceptado
  // como riesgo asumido para uso interno de RRHH (certificados, comprobantes).
  if (match(buf, 0, [0x50, 0x4b, 0x03, 0x04])) return 'docx'
  return null
}

const IMAGE_KINDS: FileKind[] = ['jpeg', 'png', 'webp', 'gif']
const AUDIO_KINDS: FileKind[] = ['mp3', 'wav']
const VIDEO_KINDS: FileKind[] = ['mp4', 'webm']
const DOC_KINDS: FileKind[] = ['doc', 'docx']

export type AllowedGroup = 'image' | 'audio' | 'video' | 'pdf' | 'pdf-or-image'

export function validateFile(buf: Buffer, allowed: AllowedGroup): { ok: true; kind: FileKind } | { ok: false; error: string } {
  const kind = detectFileKind(buf)
  if (!kind) return { ok: false, error: 'Tipo de archivo no reconocido' }
  const groups: Record<AllowedGroup, FileKind[]> = {
    image: IMAGE_KINDS,
    audio: AUDIO_KINDS,
    video: VIDEO_KINDS,
    pdf: ['pdf'],
    // "pdf-or-image" incluye también Word (.doc, .docx) para adjuntos de RRHH
    'pdf-or-image': ['pdf', ...IMAGE_KINDS, ...DOC_KINDS],
  }
  if (!groups[allowed].includes(kind)) return { ok: false, error: `Formato no permitido (${kind})` }
  return { ok: true, kind }
}

export function extForKind(kind: FileKind): string {
  return kind === 'jpeg' ? 'jpg' : kind
}
