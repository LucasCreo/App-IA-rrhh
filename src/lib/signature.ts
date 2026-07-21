import { prisma } from './prisma'
import { readFile } from 'fs/promises'

export class SignatureError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SignatureError'
    this.code = code
  }
}

export async function sendToSign(documentId: number, filePath: string, fileName: string): Promise<string> {
  const config = await prisma.signatureConfig.findFirst()
  if (!config) throw new SignatureError('SIGNATURE_NOT_CONFIGURED', 'El proveedor de firma electrónica no está configurado.')
  if (!config.providerUrl || !config.apiKey) {
    throw new SignatureError('SIGNATURE_INCOMPLETE', 'La configuración de firma está incompleta (falta URL o API key).')
  }

  const extraHeaders = JSON.parse(config.extraHeaders || '{}') as Record<string, string>
  const extraBody = JSON.parse(config.extraBody || '{}') as Record<string, unknown>
  const fileBuffer = await readFile(filePath)
  const base64 = fileBuffer.toString('base64')

  const res = await fetch(config.providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ documentId: String(documentId), fileName, fileContent: base64, ...extraBody }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new SignatureError('SIGNATURE_PROVIDER_ERROR', `El proveedor rechazó el documento (${res.status}): ${text}`)
  }

  const data = await res.json() as Record<string, unknown>
  const externalId = (data.id ?? data.externalId ?? data.documentId) as string
  if (!externalId) throw new SignatureError('SIGNATURE_PROVIDER_ERROR', 'El proveedor no devolvió un ID de documento')
  return String(externalId)
}

export async function checkSignatureStatus(externalId: string): Promise<{ status: string; signedAt?: string }> {
  const config = await prisma.signatureConfig.findFirst()
  if (!config) throw new SignatureError('SIGNATURE_NOT_CONFIGURED', 'El proveedor de firma electrónica no está configurado.')

  const extraHeaders = JSON.parse(config.extraHeaders || '{}') as Record<string, string>

  const res = await fetch(`${config.providerUrl.replace(/\/$/, '')}/${externalId}/status`, {
    headers: { Authorization: `Bearer ${config.apiKey}`, ...extraHeaders },
  })

  if (!res.ok) throw new SignatureError('SIGNATURE_PROVIDER_ERROR', `Error consultando estado en el proveedor (${res.status})`)
  return res.json() as Promise<{ status: string; signedAt?: string }>
}
