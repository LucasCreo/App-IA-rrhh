'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmpleadoDialog } from './EmpleadoDialog'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'

interface Empleado {
  id: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; estado: string
  categoria: { nombre: string }; categoriaId: number
}

export function EmpleadosTable() {
  const [data, setData] = useState<{ employees: Empleado[]; total: number; pages: number }>({ employees: [], total: 0, pages: 1 })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ open: boolean; emp?: Empleado }>({ open: false })

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, page: String(page) })
    fetch(`/api/empleados?${params}`).then(r => r.json()).then(setData)
  }, [q, page])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: number, legajo: string) {
    if (!confirm(`¿Eliminar empleado ${legajo}?`)) return
    await fetch(`/api/empleados/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, legajo, CUIL..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
          />
        </div>
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
          <Plus size={16} className="mr-1" /> Nuevo Empleado
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Legajo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>CUIL</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.employees.map(emp => (
            <TableRow key={emp.id}>
              <TableCell className="font-mono">{emp.legajo}</TableCell>
              <TableCell>{emp.apellido}, {emp.nombre}</TableCell>
              <TableCell className="font-mono text-sm">{emp.cuil}</TableCell>
              <TableCell>{emp.categoria.nombre}</TableCell>
              <TableCell>
                <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-green-600' : ''}>
                  {emp.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, emp: { ...emp, fechaIngreso: emp.fechaIngreso } })}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(emp.id, emp.legajo)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>{data.total} empleados</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
          <span className="px-2 py-1">Página {page} de {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>→</Button>
        </div>
      </div>
      {dialog.open && (
        <EmpleadoDialog
          open
          empleado={dialog.emp}
          onClose={() => setDialog({ open: false })}
          onSaved={load}
        />
      )}
    </div>
  )
}
