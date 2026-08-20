'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AreaDialog } from './AreaDialog'
import { BloqueoEliminacionDialog } from '@/components/shared/BloqueoEliminacionDialog'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface Area { id: number; nombre: string; _count: { employees: number } }
interface Dependencia { label: string; count: number; href: string }

export interface AreasTableHandle { openNew: () => void }

export const AreasTable = forwardRef<AreasTableHandle, { showTopButton?: boolean }>(function AreasTable(
  { showTopButton = true },
  ref,
) {
  const [data, setData] = useState<Area[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; area?: Area }>({ open: false })
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [blocked, setBlocked] = useState<{ nombre: string; dependencias: Dependencia[] } | null>(null)

  useImperativeHandle(ref, () => ({ openNew: () => setDialog({ open: true }) }), [])

  const load = () => fetch('/api/areas').then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  async function confirmDelete() {
    if (deleteId === null) return
    const target = data.find(a => a.id === deleteId)
    const res = await fetch(`/api/areas/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      if (res.status === 409 && Array.isArray(d?.dependencias) && target) {
        setBlocked({ nombre: target.nombre, dependencias: d.dependencias as Dependencia[] })
      } else {
        toast.error(d?.error ?? 'No se pudo eliminar')
      }
    }
    setDeleteId(null)
    load()
  }

  const deletingArea = data.find(a => a.id === deleteId)

  return (
    <div>
      {showTopButton && (
        <div className="flex justify-end mb-4">
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
            <Plus size={16} className="mr-1" /> Nueva Área
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
          {[...data].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(area => (
            <TableRow key={area.id}>
              <TableCell className="font-medium">{area.nombre}</TableCell>
              <TableCell>{area._count.employees}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, area })}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteId(area.id)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialog.open && (
        <AreaDialog
          open
          area={dialog.area}
          onClose={() => setDialog({ open: false })}
          onSaved={load}
        />
      )}

      {blocked && (
        <BloqueoEliminacionDialog
          open
          onClose={() => setBlocked(null)}
          title={`No se puede eliminar el área "${blocked.nombre}"`}
          dependencias={blocked.dependencias}
          suggest="Reasigná los empleados a otra área o cambiá el alcance de los avisos afectados antes de eliminar."
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar área "{deletingArea?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingArea?._count.employees
                ? `Tiene ${deletingArea._count.employees} empleado${deletingArea._count.employees !== 1 ? 's' : ''} asignados. No se podrá eliminar hasta reasignarlos.`
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
