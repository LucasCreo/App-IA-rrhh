'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategoriaDialog } from './CategoriaDialog'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface Categoria { id: number; nombre: string; _count: { employees: number } }

export interface CategoriasTableHandle { openNew: () => void }

export const CategoriasTable = forwardRef<CategoriasTableHandle, { showTopButton?: boolean }>(function CategoriasTable(
  { showTopButton = true },
  ref,
) {
  const [data, setData] = useState<Categoria[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; cat?: Categoria }>({ open: false })
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useImperativeHandle(ref, () => ({ openNew: () => setDialog({ open: true }) }), [])

  const load = () => fetch('/api/categorias').then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  async function confirmDelete() {
    if (deleteId === null) return
    await fetch(`/api/categorias/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const deletingCat = data.find(c => c.id === deleteId)

  return (
    <div>
      {showTopButton && (
        <div className="flex justify-end mb-4">
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
            <Plus size={16} className="mr-1" /> Nueva Categoría
          </Button>
        </div>
      )}
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
                <Button size="sm" variant="destructive" onClick={() => setDeleteId(cat.id)}>
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

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría "{deletingCat?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCat?._count.employees
                ? `Tiene ${deletingCat._count.employees} empleado${deletingCat._count.employees !== 1 ? 's' : ''} asignados. Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
