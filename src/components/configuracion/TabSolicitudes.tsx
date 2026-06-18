'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface Tipo {
  id: number; nombre: string; descripcion?: string; activo: boolean
  _count: { solicitudes: number }
}

export function TabSolicitudes() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function load() {
    fetch('/api/configuracion/tipos-solicitud').then(r => r.json()).then(setTipos)
  }

  useEffect(() => { load() }, [])

  async function handleAgregar() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre'); return }
    const res = await fetch('/api/configuracion/tipos-solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error al agregar'); return }
    setNombre(''); setDescripcion(''); load()
    toast.success('Tipo agregado')
  }

  async function toggleActivo(tipo: Tipo) {
    await fetch(`/api/configuracion/tipos-solicitud/${tipo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !tipo.activo }),
    })
    load()
  }

  function startEdit(tipo: Tipo) {
    setEditingId(tipo.id)
    setEditNombre(tipo.nombre)
    setEditDesc(tipo.descripcion ?? '')
  }

  async function saveEdit(id: number) {
    if (!editNombre.trim()) { toast.error('El nombre no puede estar vacío'); return }
    await fetch(`/api/configuracion/tipos-solicitud/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, descripcion: editDesc }),
    })
    setEditingId(null); load()
    toast.success('Tipo actualizado')
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const res = await fetch(`/api/configuracion/tipos-solicitud/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('No se puede eliminar: tiene solicitudes asociadas'); setDeleteId(null); return }
    setDeleteId(null); load()
    toast.success('Tipo eliminado')
  }

  const deletingTipo = tipos.find(t => t.id === deleteId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipos de documentos</CardTitle>
          <CardDescription>
            Definí qué tipos de documentos pueden subir los empleados desde su portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tipos.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Descripción</th>
                    <th className="text-center px-4 py-2 font-medium">Activo</th>
                    <th className="text-center px-4 py-2 font-medium">Solicitudes</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tipos.map(t => (
                    <tr key={t.id} className="border-t">
                      {editingId === t.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="h-7 text-sm" />
                          </td>
                          <td className="px-4 py-2 hidden sm:table-cell">
                            <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-7 text-sm" placeholder="Opcional" />
                          </td>
                          <td className="text-center px-4 py-2" />
                          <td className="text-center px-4 py-2" />
                          <td className="px-4 py-2 text-right space-x-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => saveEdit(t.id)}><Check size={14} /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}><X size={14} /></Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-medium">{t.nombre}</td>
                          <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{t.descripcion ?? '—'}</td>
                          <td className="text-center px-4 py-2">
                            <input
                              type="checkbox"
                              checked={t.activo}
                              onChange={() => toggleActivo(t)}
                              className="w-4 h-4 accent-green-700"
                            />
                          </td>
                          <td className="text-center px-4 py-2 text-muted-foreground">{t._count.solicitudes}</td>
                          <td className="px-4 py-2 text-right space-x-1">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => startEdit(t)}><Pencil size={13} /></Button>
                            <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => setDeleteId(t.id)}><Trash2 size={13} /></Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Nombre del tipo</p>
              <Input
                placeholder="Ej: Certificado médico"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
              <Input
                placeholder="Ej: Para justificar ausencias"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              />
            </div>
            <Button className="bg-green-700 hover:bg-green-800 shrink-0" onClick={handleAgregar}>Agregar</Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deletingTipo?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTipo?._count.solicitudes
                ? `Tiene ${deletingTipo._count.solicitudes} solicitud${deletingTipo._count.solicitudes !== 1 ? 'es' : ''} asociada${deletingTipo._count.solicitudes !== 1 ? 's' : ''}. No se puede eliminar.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!deletingTipo?._count.solicitudes && (
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
