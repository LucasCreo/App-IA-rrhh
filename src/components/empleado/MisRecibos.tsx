'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FileText, Download, BookOpen, Pen } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { cn } from '@/lib/utils'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string
  tipoDocumento?: { accion: string } | null
}

type Filtro = 'TODOS' | 'PENDIENTES' | 'FIRMADOS'

interface Props { employeeId: number }

export function MisRecibos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [marking, setMarking] = useState<number | null>(null)
  const [firmaDoc, setFirmaDoc] = useState<Doc | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  function load() {
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=true`)
      .then(r => r.json())
      .then(data => setDocs(data.docs ?? []))
  }

  useEffect(() => { load() }, [employeeId])

  const counts = useMemo(() => ({
    TODOS: docs.length,
    PENDIENTES: docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
    FIRMADOS: docs.filter(d => d.estado === 'FIRMADO').length,
  }), [docs])

  const filteredDocs = useMemo(() => {
    if (filtro === 'PENDIENTES') return docs.filter(d => d.estado === 'ENVIADO_A_FIRMA')
    if (filtro === 'FIRMADOS') return docs.filter(d => d.estado === 'FIRMADO')
    return docs
  }, [docs, filtro])

  const chips: { key: Filtro; label: string }[] = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'PENDIENTES', label: 'Pendientes' },
    { key: 'FIRMADOS', label: 'Firmados' },
  ]

  async function marcarLeido(id: number) {
    setMarking(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
    setMarking(null)
  }

  return (
    <>
      <div className="flex gap-1 flex-wrap mb-4">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
              filtro === c.key
                ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {c.label}
            <span className="opacity-60">{counts[c.key]}</span>
          </button>
        ))}
      </div>

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
          {filteredDocs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {docs.length === 0
                  ? 'No tenés recibos cargados aún.'
                  : filtro === 'PENDIENTES' ? 'No tenés recibos pendientes.' : 'No tenés recibos firmados aún.'}
              </TableCell>
            </TableRow>
          )}
          {filteredDocs.map(doc => {
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
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => marcarLeido(doc.id)} disabled={marking === doc.id}>
                      <BookOpen size={14} className="mr-1" />{marking === doc.id ? '...' : 'Marcar como leído'}
                    </Button>
                  )}
                  {pendienteFirma && (
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => setFirmaDoc(doc)}>
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
