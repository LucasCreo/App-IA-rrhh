'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentoUploadDialog } from './DocumentoUploadDialog'
import { FileText, Send, Trash2, Plus, RefreshCw } from 'lucide-react'

interface Doc {
  id: number; nombreArchivo: string; periodo: string; estado: string
  fechaCarga: string; fechaFirma?: string; firmaExternalId?: string
  employee: { nombre: string; apellido: string; legajo: string }
  cargadoPor: { email: string }
  tipoDocumento?: { id: number; nombre: string } | null
}

const estadoStyles: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  PENDIENTE_ENVIO: 'bg-yellow-100 text-yellow-700',
  ENVIADO_A_FIRMA: 'bg-blue-100 text-blue-700',
  FIRMADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  ERROR: 'bg-orange-100 text-orange-700',
}

const estadoLabel: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE_ENVIO: 'Pendiente',
  ENVIADO_A_FIRMA: 'Enviado', FIRMADO: 'Firmado',
  RECHAZADO: 'Rechazado', ERROR: 'Error',
}

export function DocumentosTable() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [sending, setSending] = useState<number | null>(null)

  const load = useCallback(() =>
    fetch('/api/documentos').then(r => r.json()).then(setDocs), [])

  useEffect(() => { load() }, [load])

  async function handleSendToSign(id: number) {
    setSending(id)
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) alert(`Error: ${data.error}`)
    setSending(null)
    load()
  }

  async function handleCheckStatus(id: number) {
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) alert(`Error: ${data.error}`)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar documento?')) return
    await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setUploadOpen(true)}>
          <Plus size={16} className="mr-1" /> Cargar Recibo
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cargado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(doc => (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="font-medium">{doc.employee.apellido}, {doc.employee.nombre}</div>
                <div className="text-xs text-muted-foreground">{doc.employee.legajo}</div>
              </TableCell>
              <TableCell className="font-mono">{doc.periodo}</TableCell>
              <TableCell>
                {doc.tipoDocumento
                  ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">{doc.tipoDocumento.nombre}</span>
                  : <span className="text-xs text-muted-foreground">—</span>
                }
              </TableCell>
              <TableCell>
                <a href={`/api/documentos/${doc.id}/archivo`} target="_blank" className="flex items-center gap-1 text-green-700 hover:underline text-sm">
                  <FileText size={14} /> {doc.nombreArchivo}
                </a>
              </TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoStyles[doc.estado]}`}>
                  {estadoLabel[doc.estado] ?? doc.estado}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {(doc.estado === 'BORRADOR' || doc.estado === 'PENDIENTE_ENVIO' || doc.estado === 'ERROR') && (
                  <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                    <Send size={14} className="mr-1" /> {sending === doc.id ? '...' : 'Firmar'}
                  </Button>
                )}
                {doc.estado === 'ENVIADO_A_FIRMA' && (
                  <Button size="sm" variant="outline" onClick={() => handleCheckStatus(doc.id)}>
                    <RefreshCw size={14} className="mr-1" /> Estado
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => handleDelete(doc.id)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {uploadOpen && <DocumentoUploadDialog open onClose={() => setUploadOpen(false)} onSaved={load} />}
    </div>
  )
}
