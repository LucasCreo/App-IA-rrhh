import SftpClient from 'ssh2-sftp-client'
import { createHash } from 'crypto'
import { logger } from './logger'

export interface SftpConfig {
  host: string
  port: number
  user: string
  password: string
}

export interface SftpArchivoInfo {
  path: string          // ruta absoluta en el SFTP
  name: string          // solo nombre (basename)
  mtimeMs: number       // último modificado (ms epoch)
  size: number
}

/**
 * Wrapper thin de ssh2-sftp-client con connect/disconnect explícitos y
 * helpers usados por el watcher: listar PDFs estables, descargar,
 * mover a la carpeta processed y calcular hash.
 */
export class Sftp {
  private client: SftpClient
  private connected = false

  constructor(private config: SftpConfig) {
    this.client = new SftpClient()
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await this.client.connect({
      host: this.config.host,
      port: this.config.port,
      username: this.config.user,
      password: this.config.password,
      readyTimeout: 20_000,
    })
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    try { await this.client.end() } catch (e) {
      logger.warn('sftp disconnect fail', { error: e instanceof Error ? e.message : String(e) })
    }
    this.connected = false
  }

  /**
   * Lista archivos .pdf en `dir` cuyo mtime sea al menos `stableSeconds`
   * atrás (evita leer archivos en escritura). Devuelve nombres ordenados.
   */
  async listPdfsEstables(dir: string, stableSeconds: number): Promise<SftpArchivoInfo[]> {
    const items = await this.client.list(dir)
    const nowMs = Date.now()
    const minAgeMs = stableSeconds * 1000
    const out: SftpArchivoInfo[] = []
    for (const it of items) {
      if (it.type !== '-') continue
      const isPdf = it.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) continue
      const mtimeMs = it.modifyTime // ya viene en ms
      if (nowMs - mtimeMs < minAgeMs) continue
      out.push({
        path: dir.replace(/\/+$/, '') + '/' + it.name,
        name: it.name,
        mtimeMs,
        size: it.size,
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  async download(remotePath: string): Promise<Buffer> {
    const res = await this.client.get(remotePath)
    if (Buffer.isBuffer(res)) return res
    if (typeof res === 'string') return Buffer.from(res)
    // ssh2-sftp-client puede devolver un stream; con `.get(path)` sin destino
    // devuelve Buffer, así que este caso no debería ocurrir.
    throw new Error('sftp get: tipo de retorno inesperado')
  }

  async move(remoteFrom: string, remoteTo: string): Promise<void> {
    await this.client.rename(remoteFrom, remoteTo)
  }

  /** Crea `dir` si no existe (recursivo). */
  async mkdirp(dir: string): Promise<void> {
    const exists = await this.client.exists(dir)
    if (exists === 'd') return
    await this.client.mkdir(dir, true)
  }
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}
