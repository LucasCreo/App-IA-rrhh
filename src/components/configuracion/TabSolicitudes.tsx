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
import { TabFormularios } from './TabFormularios'

interface CampoSolicitud {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion' | 'archivo' | 'booleano'
  opciones?: string
  requerido: boolean
}

interface Tipo {
  id: number; nombre: string; descripcion?: string; activo: boolean
  requiereAprobacion: boolean; campos: CampoSolicitud[]
  _count: { solicitudes: number }
}

const TIPOS_CAMPO = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'seleccion', label: 'Lista' },
  { value: 'archivo', label: 'Archivo' },
  { value: 'booleano', label: 'Casilla (sí/no)' },
]

function camposFromRaw(raw: unknown): CampoSolicitud[] {
  try { return Array.isArray(raw) ? raw as CampoSolicitud[] : [] } catch { return [] }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function uniqueSlug(base: string, existing: string[]) {
  const slug = base || 'campo'
  if (!existing.includes(slug)) return slug
  let n = 2
  while (existing.includes(`${slug}_${n}`)) n++
  return `${slug}_${n}`
}

export function TabSolicitudes() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [requiereNew, setRequiereNew] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editTipo, setEditTipo] = useState<Tipo | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editRequiere, setEditRequiere] = useState(true)
  const [editCampos, setEditCampos] = useState<CampoSolicitud[]>([])

  function load() {
    fetch('/api/configuracion/tipos-solicitud').then(r => r.json()).then(data =>
      setTipos(data.map((t: Tipo & { campos: unknown }) => ({ ...t, campos: camposFromRaw(t.campos) })))
    )
  }

  useEffect(() => { load() }, [])

  async function handleAgregar() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre'); return }
    const res = await fetch('/api/configuracion/tipos-solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, requiereAprobacion: requiereNew }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error al agregar'); return }
    setNombre(''); setDescripcion(''); setRequiereNew(true); setShowForm(false); load()
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
    setEditTipo(tipo)
    setEditNombre(tipo.nombre)
    setEditDesc(tipo.descripcion ?? '')
    setEditRequiere(tipo.requiereAprobacion ?? true)
    setEditCampos(tipo.campos.map(c => ({ ...c })))
  }

  function addCampo() {
    setEditCampos(prev => [...prev, { nombre: '', label: '', tipo: 'texto', requerido: false }])
  }

  function removeCampo(i: number) {
    setEditCampos(prev => prev.filter((_, j) => j !== i))
  }

  function updateCampo(i: number, key: keyof CampoSolicitud, value: string | boolean) {
    setEditCampos(prev => prev.map((c, j) => j !== i ? c : { ...c, [key]: value }))
  }

  async function saveEdit() {
    if (!editTipo || !editNombre.trim()) { toast.error('El nombre no puede estar vacío'); return }
    const conLabel = editCampos.filter(c => c.label.trim())
    // Auto-generar `nombre` interno único desde el label
    const usados: string[] = []
    const camposValidos = conLabel.map(c => {
      const nombre = c.nombre?.trim() || uniqueSlug(slugify(c.label.trim()), usados)
      usados.push(nombre)
      return { ...c, nombre, label: c.label.trim() }
    })
    await fetch(`/api/configuracion/tipos-solicitud/${editTipo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: editNombre,
        descripcion: editDesc,
        requiereAprobacion: editRequiere,
        campos: camposValidos,
      }),
    })
    setEditTipo(null); load()
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Tipos de solicitud</CardTitle>
              <CardDescription className="mt-1">
                Definí qué tipos de solicitud puede iniciar un empleado desde su portal (por ejemplo: constancia de trabajo, certificado médico).
              </CardDescription>
            </div>
            {!showForm && (
              <Button size="sm" className="bg-green-700 hover:bg-green-800 shrink-0" onClick={() => setShowForm(true)}>
                <Plus size={14} className="mr-1" /> Nuevo tipo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tipos.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Descripción</th>
                    <th className="text-center px-4 py-2 font-medium">Aprobación</th>
                    <th className="text-center px-4 py-2 font-medium">Activo</th>
                    <th className="text-center px-4 py-2 font-medium">Solicitudes</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tipos.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{t.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{t.descripcion ?? '—'}</td>
                      <td className="text-center px-4 py-2 text-xs text-muted-foreground">
                        {t.requiereAprobacion ? 'Sí' : 'Auto'}
                      </td>
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
                  <p className="text-xs text-muted-foreground mb-1">Nombre del tipo</p>
                  <Input
                    placeholder="Ej: Certificado médico"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAgregar()}
                    autoFocus
                  />
                </div>
                <div className="flex-1 min-w-40">
                  <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
                  <Input
                    placeholder="Ej: Para justificar ausencias"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAgregar()}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requiere-new"
                    checked={requiereNew}
                    onChange={e => setRequiereNew(e.target.checked)}
                    className="w-4 h-4 accent-green-700"
                  />
                  <label htmlFor="requiere-new" className="text-xs text-muted-foreground whitespace-nowrap">Requiere aprobación</label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setNombre(''); setDescripcion(''); setRequiereNew(true) }}>Cancelar</Button>
                  <Button className="bg-green-700 hover:bg-green-800" size="sm" onClick={handleAgregar}>Agregar</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editTipo !== null} onOpenChange={v => !v && setEditTipo(null)}>
        <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar tipo de solicitud</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-requiere"
                checked={editRequiere}
                onChange={e => setEditRequiere(e.target.checked)}
                className="w-4 h-4 accent-green-700"
              />
              <label htmlFor="edit-requiere" className="text-sm select-none">Requiere aprobación del admin</label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Campos adicionales</p>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addCampo}>
                  <Plus size={12} /> Agregar campo
                </Button>
              </div>
              {editCampos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin campos extra — el empleado solo puede adjuntar archivo y descripción.</p>
              ) : (
                <div className="space-y-2">
                  {editCampos.map((campo, i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 h-7 text-xs"
                          placeholder="Etiqueta del campo (ej: Motivo)"
                          value={campo.label}
                          onChange={e => updateCampo(i, 'label', e.target.value)}
                        />
                        <button onClick={() => removeCampo(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <Select value={campo.tipo} onValueChange={v => v && updateCampo(i, 'tipo', v)}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_CAMPO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={campo.requerido}
                            onChange={e => updateCampo(i, 'requerido', e.target.checked)}
                            className="w-3.5 h-3.5 accent-green-700"
                          />
                          <span className="text-xs text-muted-foreground">Requerido</span>
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
            <Button variant="outline" onClick={() => setEditTipo(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TabFormularios />

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
