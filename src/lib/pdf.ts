import { detectFileKind } from './fileValidation'

export const MAX_PDF_SIZE = 10 * 1024 * 1024

export function isPdfBuffer(buffer: Buffer): boolean {
  return detectFileKind(buffer) === 'pdf'
}

export async function isPdfFile(file: File): Promise<boolean> {
  const header = await file.slice(0, 4).arrayBuffer()
  return isPdfBuffer(Buffer.from(header))
}
