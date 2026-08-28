import { prisma } from '@/lib/prisma'
import { getAditusFile, updateAditusFileMetadata, deleteAditusFile } from '@/lib/aditus'
import { reciboProps } from '@/lib/aditusRecibos'
import {
  runValidators,
  pdfIntegridadValidator,
  nomencladorValidator,
  legajoExistenteValidator,
  type EmpleadoMin,
} from '@/lib/validators'
import type { JobRecord } from '@/lib/jobQueue'
import { actualizarProgresoLote } from '@/lib/loteProgress'
import { logger } from '../logger'
import { Sftp } from '../sftpClient'
import type { ProcessArchivoPayload } from './ingestSftp'

export { actualizarProgresoLote }

const VALIDATORS = [pdfIntegridadValidator, nomencladorValidator, legajoExistenteValidator]

/**
 * Handler PROCESS_ARCHIVO:
 *  1. Baja el archivo de Aditus (ya subido por INGEST_SFTP).
 *  2. Corre el motor de validators.
 *  3. Si pasa → crea Document + LoteEmpleado, actualiza metadata en Aditus.
 *     Si duplicado con otro doc del lote → va a Pendiente.
 *  4. Si falla → crea LoteArchivoPendiente con motivos serializados.
 *  5. Actualiza SftpArchivoProcesado con documentId/pendienteId.
 *  6. Recalcula Lote.progreso y, si terminó el ciclo, transiciona a
 *     LISTO / CON_ERRORES.
 */
export async function procesarArchivoHandler(job: JobRecord<ProcessArchivoPayload>) {
  const { loteId, aditusId, filename, sftpProcId } = job.payload
  if (!loteId || !aditusId || !filename || !sftpProcId) {
    throw new Error('payload incompleto')
  }

  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    select: { id: true, nombre: true, periodo: true, tipoDocumentoId: true, creadoPorId: true },
  })
  if (!lote) throw new Error(`Lote ${loteId} no existe`)

  // Cargar patrones y config SFTP (para mover el archivo al final).
  const config = await prisma.generalConfig.findFirst({
    select: {
      reciboFilenamePatterns: true,
      sftpHost: true, sftpPort: true, sftpUser: true, sftpPassword: true,
      sftpProcessedPath: true, sftpErrorsPath: true,
    },
  })
  let patterns: string[] = []
  try {
    if (config?.reciboFilenamePatterns) {
      const parsed = JSON.parse(config.reciboFilenamePatterns)
      if (Array.isArray(parsed)) patterns = parsed.filter((x: unknown) => typeof x === 'string')
    }
  } catch { /* patrones inválidos */ }

  // Empleados activos: para SFTP no hay scope de usuario, tomamos todos.
  const empleadosActivos = await prisma.employee.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true, legajo: true, nombre: true, apellido: true, cuil: true },
  })
  const legajoSet = new Set(empleadosActivos.map(e => e.legajo))
  const empByLegajo = new Map<string, EmpleadoMin>(empleadosActivos.map(e => [e.legajo, e]))

  // Bajar del Aditus (endpoint download para binario real).
  const aditusFile = await getAditusFile(aditusId, { download: true })
  const buffer = aditusFile.content

  const validacion = await runValidators(VALIDATORS, {
    buffer,
    fileName: filename,
    patterns,
    legajosValidos: legajoSet,
    empByLegajo,
  })

  const emp = validacion.metadata.empleado as EmpleadoMin | undefined
  const legajoFinal = typeof validacion.metadata.legajo === 'string' ? validacion.metadata.legajo : null

  let documentId: number | null = null
  let pendienteId: number | null = null
  let asignado = false

  if (validacion.pass && emp) {
    // Chequear duplicado dentro del lote de forma atómica.
    try {
      await prisma.$transaction(async tx => {
        const existente = await tx.document.findFirst({
          where: { loteId: lote.id, employeeId: emp.id },
          select: { id: true },
        })
        if (existente) throw new Error('__DUPLICADO__')

        const doc = await tx.document.create({
          data: {
            nombreArchivo: filename,
            aditusId,
            periodo: lote.periodo,
            employeeId: emp.id,
            cargadoPorId: lote.creadoPorId,
            estado: 'BORRADOR',
            loteId: lote.id,
            ...(lote.tipoDocumentoId ? { tipoDocumentoId: lote.tipoDocumentoId } : {}),
          },
        })
        await tx.loteEmpleado.upsert({
          where: { loteId_employeeId: { loteId: lote.id, employeeId: emp.id } },
          create: { loteId: lote.id, employeeId: emp.id },
          update: {},
        })
        documentId = doc.id
      })
      asignado = true

      // Actualizar metadata Aditus (best-effort) con los datos completos del empleado.
      updateAditusFileMetadata(aditusId, reciboProps({
        empleado: emp, periodo: lote.periodo, loteNombre: lote.nombre,
      })).catch(e => logger.warn('aditus update metadata fail', { aditusId, error: e instanceof Error ? e.message : String(e) }))
    } catch (e) {
      if (e instanceof Error && e.message === '__DUPLICADO__') {
        const motivos = [{
          code: 'DUPLICADO_EN_LOTE',
          message: `El legajo ${emp.legajo} ya tiene un archivo asignado en este lote`,
          validator: 'lote',
        }]
        const pend = await prisma.loteArchivoPendiente.create({
          data: {
            loteId: lote.id,
            aditusId,
            nombreArchivo: filename,
            legajoDetectado: legajoFinal ?? emp.legajo,
            motivos: JSON.stringify(motivos),
          },
        })
        pendienteId = pend.id
      } else {
        throw e
      }
    }
  } else {
    // No pasó validación → pendiente con motivos tipados.
    const motivos = [...validacion.errors, ...validacion.warnings]
    const pend = await prisma.loteArchivoPendiente.create({
      data: {
        loteId: lote.id,
        aditusId,
        nombreArchivo: filename,
        legajoDetectado: legajoFinal ?? null,
        motivos: motivos.length > 0 ? JSON.stringify(motivos) : null,
      },
    })
    pendienteId = pend.id
  }

  // Actualizar el registro de idempotencia con el resultado.
  await prisma.sftpArchivoProcesado.update({
    where: { id: sftpProcId },
    data: { documentId, pendienteId },
  }).catch(() => { /* si se borró, no rompemos el flujo */ })

  // Mover el archivo original en el SFTP según resultado:
  //   OK    → processedPath
  //   FALLO → errorsPath (o processedPath si no está configurada)
  const sftpProc = await prisma.sftpArchivoProcesado.findUnique({
    where: { id: sftpProcId }, select: { path: true },
  })
  if (sftpProc?.path && config?.sftpHost && config.sftpUser && config.sftpPassword) {
    const esFallo = pendienteId !== null
    const destino = esFallo
      ? (config.sftpErrorsPath || config.sftpProcessedPath || null)
      : (config.sftpProcessedPath || null)
    if (destino) {
      moverArchivoSftp({
        host: config.sftpHost, port: config.sftpPort ?? 22,
        user: config.sftpUser, password: config.sftpPassword,
      }, sftpProc.path, destino, filename)
        .catch(e => logger.warn('sftp move final fail', {
          path: sftpProc.path, destino, error: e instanceof Error ? e.message : String(e),
        }))
    }
  }

  await actualizarProgresoLote(lote.id)

  logger.info('procesar archivo OK', {
    loteId: lote.id, filename, asignado, documentId, pendienteId,
    errores: validacion.errors.length, warnings: validacion.warnings.length,
  })
}

async function moverArchivoSftp(
  creds: { host: string; port: number; user: string; password: string },
  fromPath: string,
  destinoDir: string,
  filename: string,
): Promise<void> {
  const sftp = new Sftp(creds)
  try {
    await sftp.connect()
    await sftp.mkdirp(destinoDir)
    const dest = destinoDir.replace(/\/+$/, '') + '/' + `${Date.now()}_${filename}`
    await sftp.move(fromPath, dest)
  } finally {
    await sftp.disconnect()
  }
}

/**
 * Cleanup de archivo abandonado en Aditus. Se llama sólo si el handler no
 * pudo ni crear Document ni Pendiente por un error inesperado.
 */
export async function limpiarAditusHuerfano(aditusId: string) {
  try { await deleteAditusFile(aditusId) } catch { /* best-effort */ }
}
