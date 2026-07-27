'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Download, BookOpen, Pen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'

interface Doc {
  id: number
  nombreArchivo: string
  periodo: string | null
  estado: string
  fechaCarga: string
  fechaFirma?: string
  tipoDocumento?: { nombre: string; accion: string } | null
}

interface Props { employeeId: number }

export function MisDocumentos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [acting, setActing] = useState<number | null>(null)
  const [firmaDoc, setFirmaDoc] = useState<Doc | null>(null)

  function load() {
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=false`)
      .then(r => r.json())
      .then(data => setDocs(data.docs ?? []))
  }

  useEffect(() => { load() }, [employeeId])

  async function marcarLeido(id: number) {
    setActing(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
    setActing(null)
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <FileText size={32} strokeWidth={1.2} />
        <p className="text-sm">No tenés documentos cargados aún.</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {docs.map(doc => {
        const accion = doc.tipoDocumento?.accion
        const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
        const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'

        return (
          <div key={doc.id} className="flex items-center gap-3 px-5 py-4">
            <FileText size={16} className="text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.tipoDocumento?.nombre ?? doc.nombreArchivo}</p>
              <p className="text-xs text-muted-foreground">
                {doc.periodo ? `Período ${doc.periodo} · ` : ''}
                {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
              </p>
            </div>
            <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
            <div className="flex items-center gap-1 shrink-0">
              {pendienteLectura && (
                <Button
                  size="sm"
                  className="bg-green-700 hover:bg-green-800 text-white"
                  disabled={acting === doc.id}
                  onClick={() => marcarLeido(doc.id)}
                >
                  <BookOpen size={13} className="mr-1" />
                  {acting === doc.id ? '...' : 'Marcar leído'}
                </Button>
              )}
              {pendienteFirma && (
                <Button
                  size="sm"
                  className="bg-green-700 hover:bg-green-800 text-white"
                  onClick={() => setFirmaDoc(doc)}
                >
                  <Pen size={13} className="mr-1" /> Firmar
                </Button>
              )}
              {!pendienteFirma && (
                <>
                  <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
                    <Button size="sm" variant="ghost"><FileText size={14} /></Button>
                  </a>
                  <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
                    <Button size="sm" variant="ghost"><Download size={14} /></Button>
                  </a>
                </>
              )}
            </div>
          </div>
        )
      })}

      <FirmarDocumentoDialog
        open={firmaDoc !== null}
        docId={firmaDoc?.id ?? null}
        titulo="Firmar documento"
        descripcion={firmaDoc?.tipoDocumento?.nombre ?? firmaDoc?.nombreArchivo ?? ''}
        onClose={() => setFirmaDoc(null)}
        onFirmado={load}
      />
    </div>
  )
}
