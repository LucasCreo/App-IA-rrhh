'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Plus, X } from 'lucide-react'

interface Campo {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion'
  opciones?: string
  requerido: boolean
  rellena?: 'admin' | 'empleado'
}

interface Plantilla {
  id: number
  nombre: string
  descripcion?: string
  activo: boolean
  campos: Campo[]
  _count: { asignaciones: number }
}

const TIPOS_CAMPO = [
  { value: 'texto', label: 'Texto libre' },
  { value: 'numero', label: 'Número' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'seleccion', label: 'Selección' },
]

export function TabFormularios() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editPlantilla, setEditPlantilla] = useState<Plantilla | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCampos, setEditCampos] = useState<Campo[]>([])

  function load() {
    fetch('/api/configuracion/plantillas-formulario').then(r => r.json()).then(setPlantillas)
  }
  useEffect(() => { load() }, [])

  async function handleAgregar() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre'); return }
    const res = await fetch('/api/configuracion/plantillas-formulario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error'); return }
    setNombre(''); setDescripcion(''); setShowForm(false); load()
    toast.success('Plantilla creada')
  }

  async function toggleActivo(p: Plantilla) {
    await fetch(`/api/configuracion/plantillas-formulario/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    load()
  }

  function startEdit(p: Plantilla) {
    setEditPlantilla(p)
    setEditNombre(p.nombre)
    setEditDesc(p.descripcion ?? '')
    setEditCampos(p.campos.map(c => ({ ...c })))
  }

  function addCampo() {
    setEditCampos(prev => [...prev, { nombre: '', label: '', tipo: 'texto', requerido: false, rellena: 'empleado' }])
  }

  function removeCampo(i: number) {
    setEditCampos(prev => prev.filter((_, j) => j !== i))
  }

  function updateCampo(i: number, key: keyof Campo, value: string | boolean) {
    setEditCampos(prev => prev.map((c, j) => j !== i ? c : { ...c, [key]: value }))
  }

  async function saveEdit() {
    if (!editPlantilla || !editNombre.trim()) { toast.error('El nombre no puede estar vacío'); return }
    const camposValidos = editCampos.filter(c => c.nombre.trim() && c.label.trim())
    const res = await fetch(`/api/configuracion/plantillas-formulario/${editPlantilla.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, descripcion: editDesc, campos: camposValidos }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error'); return }
    setEditPlantilla(null); load()
    toast.success('Plantilla actualizada')
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const res = await fetch(`/api/configuracion/plantillas-formulario/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('No se puede eliminar: tiene asignaciones asociadas'); setDeleteId(null); return }
    setDeleteId(null); load()
    toast.success('Plantilla eliminada')
  }

  const deletingPlantilla = plantillas.find(p => p.id === deleteId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Plantillas de formularios</CardTitle>
              <CardDescription className="mt-1">
                Definí formularios que los empleados deben completar cuando se los asignes.
              </CardDescription>
            </div>
            {!showForm && (
              <Button size="sm" className="bg-green-700 hover:bg-green-800 shrink-0" onClick={() => setShowForm(true)}>
                <Plus size={14} className="mr-1" /> Nueva plantilla
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {plantillas.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Descripción</th>
                    <th className="text-center px-4 py-2 font-medium">Campos</th>
                    <th className="text-center px-4 py-2 font-medium">Asignaciones</th>
                    <th className="text-center px-4 py-2 font-medium">Activo</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{p.descripcion ?? '—'}</td>
                      <td className="text-center px-4 py-2 text-muted-foreground">{p.campos.length}</td>
                      <td className="text-center px-4 py-2 text-muted-foreground">{p._count.asignaciones}</td>
                      <td className="text-center px-4 py-2">
                        <input type="checkbox" checked={p.activo} onChange={() => toggleActivo(p)} className="w-4 h-4 accent-green-700" />
                      </td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => startEdit(p)}><Pencil size={13} /></Button>
                        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => setDeleteId(p.id)}><Trash2 size={13} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showForm && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="text-xs text-muted-foreground mb-1">Nombre de la plantilla</p>
                  <Input placeholder="Ej: Datos bancarios" value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAgregar()} autoFocus />
                </div>
                <div className="flex-1 min-w-40">
                  <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
                  <Input placeholder="Ej: Para alta de haberes" value={descripcion} onChange={e => setDescripcion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAgregar()} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setNombre(''); setDescripcion('') }}>Cancelar</Button>
                <Button className="bg-green-700 hover:bg-green-800" size="sm" onClick={handleAgregar}>Agregar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editPlantilla !== null} onOpenChange={v => !v && setEditPlantilla(null)}>
        <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre</p>
              <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Campos del formulario</p>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addCampo}>
                  <Plus size={12} /> Agregar campo
                </Button>
              </div>
              {editCampos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin campos todavía. Agregá al menos uno.</p>
              ) : (
                <div className="space-y-2">
                  {editCampos.map((campo, i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 h-7 text-xs"
                          placeholder="Nombre interno (sin espacios)"
                          value={campo.nombre}
                          onChange={e => updateCampo(i, 'nombre', e.target.value.replace(/\s/g, '_').toLowerCase())}
                        />
                        <Input
                          className="flex-1 h-7 text-xs"
                          placeholder="Etiqueta visible"
                          value={campo.label}
                          onChange={e => updateCampo(i, 'label', e.target.value)}
                        />
                        <button onClick={() => removeCampo(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Select value={campo.tipo} onValueChange={v => v && updateCampo(i, 'tipo', v)}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_CAMPO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <input type="checkbox" checked={campo.requerido} onChange={e => updateCampo(i, 'requerido', e.target.checked)} className="w-3.5 h-3.5 accent-green-700" />
                          <span className="text-xs text-muted-foreground">Requerido</span>
                        </div>
                        <div className="flex items-center rounded-md border overflow-hidden text-xs">
                          <button
                            type="button"
                            className={`px-2 py-1 transition-colors ${(campo.rellena ?? 'empleado') === 'empleado' ? 'bg-green-700 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                            onClick={() => updateCampo(i, 'rellena', 'empleado')}
                          >Empleado</button>
                          <button
                            type="button"
                            className={`px-2 py-1 transition-colors ${campo.rellena === 'admin' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                            onClick={() => updateCampo(i, 'rellena', 'admin')}
                          >Admin</button>
                        </div>
                      </div>
                      {campo.tipo === 'seleccion' && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Opciones (separadas por coma)</p>
                          <Input
                            className="h-7 text-xs"
                            placeholder="Ej: Opción 1, Opción 2, Opción 3"
                            value={campo.opciones ?? ''}
                            onChange={e => updateCampo(i, 'opciones', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditPlantilla(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deletingPlantilla?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPlantilla?._count.asignaciones
                ? `Tiene ${deletingPlantilla._count.asignaciones} asignación/es. No se puede eliminar.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!deletingPlantilla?._count.asignaciones && (
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
