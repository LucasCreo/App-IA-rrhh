'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Log {
  id: number; accion: string; entidad: string; detalle?: string; createdAt: string
  user: { email: string }
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<Log[]>([])

  useEffect(() => {
    fetch('/api/auditoria').then(r => r.json()).then(setLogs)
  }, [])

  return (
    <>
      <AdminHeader title="Auditoría" />
      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('es-AR')}
                </TableCell>
                <TableCell className="text-sm">{log.user.email}</TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 bg-green-50 text-green-800 rounded text-xs font-mono">
                    {log.accion}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{log.entidad}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{log.detalle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
