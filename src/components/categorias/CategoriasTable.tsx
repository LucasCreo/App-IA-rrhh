'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoriaDialog } from './CategoriaDialog'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface Categoria { id: number; nombre: string; _count: { employees: number } }

export function CategoriasTable() {
  const [data, setData] = useState<Categoria[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; cat?: Categoria }>({ open: false })

  const load = () => fetch('/api/categorias').then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar categoría?')) return
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
          <Plus size={16} className="mr-1" /> Nueva Categoría
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Empleados</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(cat => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">{cat.nombre}</TableCell>
              <TableCell>{cat._count.employees}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, cat })}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(cat.id)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog.open && (
        <CategoriaDialog
          open
          categoria={dialog.cat}
          onClose={() => setDialog({ open: false })}
          onSaved={load}
        />
      )}
    </div>
  )
}
