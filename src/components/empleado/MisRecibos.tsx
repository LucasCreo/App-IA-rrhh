'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FileText, Download } from 'lucide-react'

interface Doc {
  id: number; nombreArchivo: string; periodo: string; estado: string
  fechaCarga: string; fechaFirma?: string
}

const estadoLabel: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE_ENVIO: 'Pendiente', ENVIADO_A_FIRMA: 'Enviado a firma',
  FIRMADO: 'Firmado', RECHAZADO: 'Rechazado', ERROR: 'Error',
}

const estadoColor: Record<string, string> = {
  BORRADOR: 'text-gray-500', PENDIENTE_ENVIO: 'text-yellow-600', ENVIADO_A_FIRMA: 'text-blue-600',
  FIRMADO: 'text-green-700 font-medium', RECHAZADO: 'text-red-600', ERROR: 'text-orange-600',
}

interface Props { employeeId: number }

export function MisRecibos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])

  useEffect(() => {
    fetch(`/api/documentos?employeeId=${employeeId}`)
      .then(r => r.json())
      .then(setDocs)
  }, [employeeId])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Período</TableHead>
          <TableHead>Archivo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha Firma</TableHead>
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
        {docs.map(doc => (
          <TableRow key={doc.id}>
            <TableCell className="font-mono">{doc.periodo}</TableCell>
            <TableCell>{doc.nombreArchivo}</TableCell>
            <TableCell className={estadoColor[doc.estado] ?? ''}>
              {estadoLabel[doc.estado] ?? doc.estado}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {doc.fechaFirma ? new Date(doc.fechaFirma).toLocaleDateString('es-AR') : '—'}
            </TableCell>
            <TableCell className="text-right space-x-1">
              <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
                <Button size="sm" variant="outline"><FileText size={14} /></Button>
              </a>
              <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
                <Button size="sm" variant="outline"><Download size={14} /></Button>
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
