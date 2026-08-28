import { prisma } from '@/lib/prisma'
import { uploadAditusFile } from '@/lib/aditus'
import { reciboPendienteProps } from '@/lib/aditusRecibos'
import { extraerMetadataDesdeFilename } from '@/lib/recibosDetect'
import { enqueue } from '@/lib/jobQueue'
import type { JobRecord } from '@/lib/jobQueue'
import { Sftp, sha256 } from '../sftpClient'
import { getReciboTipoId } from '@/lib/tiposDocumento'
import { logger } from '../logger'
import { actualizarProgresoLote } from './procesarArchivo'

export interface IngestSftpPayload {
  path: string  // ruta remota original en el SFTP
}

export interface ProcessArchivoPayload {
  loteId: number
  aditusId: string
  filename: string
  sftpProcId: number
  totalEnCiclo?: number
}

/**
 * Formatea "MMMM YYYY" en español para el nombre visible del lote.
 * Ej: (8, 2026) → "Agosto 2026"
 */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function nombreLoteMensual(mes: number, anio: number): string {
  const m = mes >= 1 && mes <= 12 ? MESES[mes - 1] : `Mes ${mes}`
  return `Sueldos ${m} ${anio}`
}

/**
 * Handler INGEST_SFTP:
 *  1. Conecta al SFTP y descarga el archivo.
 *  2. Calcula hash + chequea idempotencia contra SftpArchivoProcesado.
 *  3. Sube a Aditus con metadata inicial (pendiente); el update final lo
 *     hace PROCESS_ARCHIVO con datos del empleado.
 *  4. Encuentra o crea el Lote del mes (origen=SFTP, estado=PROCESANDO).
 *  5. Registra en SftpArchivoProcesado (idempotencia).
 *  6. Mueve el archivo en el SFTP a sftpProcessedPath.
 *  7. Encola PROCESS_ARCHIVO con el aditusId.
 */
export async function ingestSftpHandler(job: JobRecord<IngestSftpPayload>) {
  const { path } = job.payload
  if (!path) throw new Error('payload.path requerido')

  const config = await prisma.generalConfig.findFirst()
  if (!config?.sftpEnabled) throw new Error('SFTP no habilitado')
  if (!config.sftpHost || !config.sftpUser || !config.sftpPassword || !config.sftpProcessedPath) {
    throw new Error('SFTP no configurado (host/user/password/processedPath)')
  }
  // Fallback: si errorsPath no está configurado, usamos processedPath
  const errorsPath = config.sftpErrorsPath || config.sftpProcessedPath

  // Idempotencia: si el path ya está registrado, no reprocesamos.
  const yaProcesado = await prisma.sftpArchivoProcesado.findUnique({ where: { path } })
  if (yaProcesado) {
    logger.info('sftp path ya procesado, skip', { path, id: yaProcesado.id })
    return
  }

  // Cargar patrones del nomenclador para extraer mes/año.
  let patterns: string[] = []
  try {
    if (config.reciboFilenamePatterns) {
      const parsed = JSON.parse(config.reciboFilenamePatterns)
      if (Array.isArray(parsed)) patterns = parsed.filter((x: unknown) => typeof x === 'string')
    }
  } catch { /* patrones inválidos */ }

  const filename = path.split('/').pop() ?? path
  const meta = patterns.length > 0 ? extraerMetadataDesdeFilename(filename, patterns) : null
  const now = new Date()
  const mes = meta?.mes ?? (now.getMonth() + 1)
  const anio = meta?.anio ?? now.getFullYear()

  const sftp = new Sftp({
    host: config.sftpHost,
    port: config.sftpPort ?? 22,
    user: config.sftpUser,
    password: config.sftpPassword,
  })

  let buffer: Buffer
  try {
    await sftp.connect()
    buffer = await sftp.download(path)
  } catch (e) {
    await sftp.disconnect()
    throw e
  }

  const hash = sha256(buffer)

  // Segunda chance de idempotencia: por hash (mismo contenido con distinto path).
  // Si el hash existe → subimos a Aditus igual y creamos un LoteArchivoPendiente
  // con motivo DUPLICADO_HASH en el mismo lote del original, para que el admin
  // lo vea en la UI y decida (eliminar / re-subir a mano).
  const yaProcesadoHash = await prisma.sftpArchivoProcesado.findFirst({ where: { hash } })
  if (yaProcesadoHash) {
    logger.info('sftp hash duplicado, creando pendiente', { path, hash, existingPath: yaProcesadoHash.path })
    const targetLoteId = yaProcesadoHash.loteId
    if (!targetLoteId) {
      // Original no tiene lote asignado (edge case) → solo audit + mover.
      await moverAProcessed(sftp, path, filename, config.sftpProcessedPath)
      await sftp.disconnect()
      await prisma.sftpArchivoProcesado.create({ data: { path, hash } })
      return
    }
    let aditusIdDup: string
    try {
      aditusIdDup = await uploadAditusFile({
        content: buffer,
        fileName: filename,
        contentType: 'application/pdf',
        properties: reciboPendienteProps({ fileName: filename, loteNombre: 'Duplicado' }),
      })
    } catch (e) {
      await sftp.disconnect()
      throw e
    }
    try {
      // Duplicado hash → va a errors (o processed si no hay errors configurado)
      await moverAProcessed(sftp, path, filename, errorsPath)
    } catch (e) {
      logger.warn('sftp move fail (dup), seguimos igual', { path, error: e instanceof Error ? e.message : String(e) })
    } finally {
      await sftp.disconnect()
    }
    const origFilename = yaProcesadoHash.path.split('/').pop() ?? yaProcesadoHash.path
    const motivos = [{
      code: 'DUPLICADO_HASH',
      message: `Contenido idéntico a "${origFilename}" ya procesado en este lote.`,
      validator: 'sftp',
    }]
    const pend = await prisma.loteArchivoPendiente.create({
      data: {
        loteId: targetLoteId,
        aditusId: aditusIdDup,
        nombreArchivo: filename,
        motivos: JSON.stringify(motivos),
      },
    })
    await prisma.sftpArchivoProcesado.create({
      data: { path, hash, loteId: targetLoteId, pendienteId: pend.id },
    })
    await actualizarProgresoLote(targetLoteId)
    return
  }

  // Sube a Aditus con props pendientes iniciales (nombre + tipo).
  let aditusId: string
  try {
    aditusId = await uploadAditusFile({
      content: buffer,
      fileName: filename,
      contentType: 'application/pdf',
      properties: reciboPendienteProps({ fileName: filename, loteNombre: nombreLoteMensual(mes, anio) }),
    })
  } catch (e) {
    await sftp.disconnect()
    throw e
  }

  // Encuentra o crea el lote del mes (origen=SFTP, no cerrado).
  const tipoDocumentoId = await getReciboTipoId()
  const lote = await prisma.$transaction(async tx => {
    const existente = await tx.lote.findFirst({
      where: { origen: 'SFTP', mes, anio, estado: { in: ['ABIERTO', 'PROCESANDO'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existente) {
      if (existente.estado !== 'PROCESANDO') {
        await tx.lote.update({ where: { id: existente.id }, data: { estado: 'PROCESANDO' } })
      }
      return existente
    }
    // Sistema (user id fijo): usamos el primer admin como creadoPorId.
    const admin = await tx.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } })
    if (!admin) throw new Error('No hay usuario ADMIN para asignar como creador del lote SFTP')
    return tx.lote.create({
      data: {
        nombre: nombreLoteMensual(mes, anio),
        descripcion: `Ingesta automática desde SFTP (${config.sftpHost})`,
        periodo: `${anio}-${String(mes).padStart(2, '0')}`,
        creadoPorId: admin.id,
        origen: 'SFTP',
        estado: 'PROCESANDO',
        progreso: 0,
        mes,
        anio,
        ...(tipoDocumentoId ? { tipoDocumentoId } : {}),
      },
    })
  })

  // Idempotencia: registramos el archivo ANTES de cerrar la conexión SFTP.
  // El archivo se mueve al final del pipeline (en PROCESS_ARCHIVO) según
  // el resultado (processed = OK, errors = fallo). El watcher no lo re-baja
  // porque el path ya está en SftpArchivoProcesado.
  const sftpProc = await prisma.sftpArchivoProcesado.create({
    data: { path, hash, loteId: lote.id },
  })

  await sftp.disconnect()

  await enqueue<ProcessArchivoPayload>('PROCESS_ARCHIVO', {
    loteId: lote.id,
    aditusId,
    filename,
    sftpProcId: sftpProc.id,
  })

  logger.info('sftp ingest OK', { path, loteId: lote.id, aditusId, mes, anio })
}

async function moverAProcessed(sftp: Sftp, fromPath: string, filename: string, processedDir: string) {
  await sftp.mkdirp(processedDir)
  const dest = processedDir.replace(/\/+$/, '') + '/' + `${Date.now()}_${filename}`
  await sftp.move(fromPath, dest)
}
