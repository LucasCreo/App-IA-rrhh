'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FileText, Download, BookOpen, Pen } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string
  tipoDocumento?: { accion: string } | null
}

interface Props { employeeId: number }

export function MisRecibos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [marking, setMarking] = useState<number | null>(null)
  const [firmaDoc, setFirmaDoc] = useState<Doc | null>(null)

  function load() {
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=true`)
      .then(r => r.json())
      .then(data => setDocs(data.docs ?? []))
  }

  useEffect(() => { load() }, [employeeId])

  async function marcarLeido(id: number) {
    setMarking(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
    setMarking(null)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No tenés recibos cargados aún.
              </TableCell>
            </TableRow>
          )}
          {docs.map(doc => {
            const accion = doc.tipoDocumento?.accion
            const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
            const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'
            return (
              <TableRow key={doc.id}>
                <TableCell className="font-mono">{doc.periodo ?? '—'}</TableCell>
                <TableCell>{doc.nombreArchivo}</TableCell>
                <TableCell>
                  <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {doc.fechaFirma ? new Date(doc.fechaFirma).toLocaleDateString('es-AR') : '—'}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {pendienteLectura && (
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => marcarLeido(doc.id)} disabled={marking === doc.id}>
                      <BookOpen size={14} className="mr-1" />{marking === doc.id ? '...' : 'Marcar como leído'}
                    </Button>
                  )}
                  {pendienteFirma && (
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => setFirmaDoc(doc)}>
                      <Pen size={14} className="mr-1" /> Firmar
                    </Button>
                  )}
                  <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
                    <Button size="sm" variant="outline"><FileText size={14} /></Button>
                  </a>
                  <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
                    <Button size="sm" variant="outline"><Download size={14} /></Button>
                  </a>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <FirmarDocumentoDialog
        open={firmaDoc !== null}
        docId={firmaDoc?.id ?? null}
        titulo="Firmar recibo"
        descripcion={`Recibo del período ${firmaDoc?.periodo ?? firmaDoc?.nombreArchivo ?? ''}`}
        onClose={() => setFirmaDoc(null)}
        onFirmado={load}
      />
    </>
  )
}
