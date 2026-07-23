'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ClipboardList, Plus, Search, CheckSquare, Square, Trash2, Pencil, AlertTriangle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface Asignacion {
  id: number
  nombre: string
  plantillaId: number
  plantilla: { nombre: string }
  fechaLimite: string | null
  createdAt: string
  _count: { respuestas: number }
  enviadas: number
  respuestas: { employee: { nombre: string; apellido: string } }[]
}

interface Campo { nombre: string; label: string; tipo: string; opciones?: string; rellena?: 'admin' | 'empleado' }
interface Plantilla { id: number; nombre: string; activo: boolean; campos: Campo[] }
interface Empleado { id: number; nombre: string; apellido: string; legajo: string }

export function AsignacionesList() {
  const router = useRouter()
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [plantillaId, setPlantillaId] = useState<string>('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [datosAdmin, setDatosAdmin] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<Asignacion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toEdit, setToEdit] = useState<Asignacion | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPlantillaId, setEditPlantillaId] = useState('')
  const [editFechaLimite, setEditFechaLimite] = useState('')
  const [editDatosAdmin, setEditDatosAdmin] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)

  function load() {
    fetch('/api/formularios/asignaciones').then(r => r.json()).then(setAsignaciones)
  }

  useEffect(() => { load() }, [])

  async function openDialog() {
    const [pRes, eRes] = await Promise.all([
      fetch('/api/configuracion/plantillas-formulario').then(r => r.json()),
      fetch('/api/empleados?all=true').then(r => r.json()),
    ])
    setPlantillas((pRes as Plantilla[]).filter(p => p.activo))
    setEmpleados((eRes as any).employees ?? eRes)
    setNombre(''); setPlantillaId(''); setFechaLimite(''); setSearch(''); setSelected([]); setDatosAdmin({})
    setOpen(true)
  }

  const filtered = empleados.filter(e =>
    `${e.nombre} ${e.apellido} ${e.legajo}`.toLowerCase().includes(search.toLowerCase())
  )

  function toggleEmpleado(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleAll() {
    const ids = filtered.map(e => e.id)
    const allSelected = ids.every(id => selected.includes(id))
    setSelected(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  async function openEditDialog(a: Asignacion) {
    const [pRes, detail] = await Promise.all([
      fetch('/api/configuracion/plantillas-formulario').then(r => r.json()),
      fetch(`/api/formularios/asignaciones/${a.id}`).then(r => r.json()),
    ])
    setPlantillas((pRes as Plantilla[]).filter(p => p.activo))
    setEditNombre(a.nombre)
    setEditPlantillaId(String(a.plantillaId))
    setEditFechaLimite(a.fechaLimite ? a.fechaLimite.slice(0, 10) : '')
    setEditDatosAdmin(detail.datosAdmin ?? {})
    setToEdit(a)
  }

  async function handleEdit() {
    if (!editNombre.trim()) { toast.error('Ingresá un nombre'); return }
    setEditSaving(true)
    const res = await fetch(`/api/formularios/asignaciones/${toEdit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, plantillaId: Number(editPlantillaId), fechaLimite: editFechaLimite || null, datosAdmin: editDatosAdmin }),
    })
    setEditSaving(false)
    if (!res.ok) { toast.error('Error al guardar'); return }
    setToEdit(null); load()
    toast.success('Solicitud actualizada')
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    const res = await fetch(`/api/formularios/asignaciones/${toDelete.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { toast.error('Error al eliminar'); return }
    setToDelete(null); load()
    toast.success('Solicitud eliminada')
  }

  async function handleCrear() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre'); return }
    if (!plantillaId) { toast.error('Seleccioná una plantilla'); return }
    if (selected.length === 0) { toast.error('Seleccioná al menos un empleado'); return }
    setSaving(true)
    const res = await fetch('/api/formularios/asignaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, plantillaId: Number(plantillaId), fechaLimite: fechaLimite || null, employeeIds: selected, datosAdmin }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error'); return }
    setOpen(false); load()
    toast.success('Solicitud creada')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{asignaciones.length} solicitud{asignaciones.length !== 1 ? 'es' : ''}</p>
        <Button className="bg-green-700 hover:bg-green-800 gap-1.5" onClick={openDialog}>
          <Plus size={15} /> Nueva solicitud
        </Button>
      </div>

      {asignaciones.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin solicitudes creadas todavía</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Plantilla</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Asignados a</th>
                <th className="text-center px-4 py-2.5 font-medium">Progreso</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Fecha límite</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Creada</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map(a => (
                <tr
                  key={a.id}
                  className="border-t hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/formularios/${a.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{a.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                      {a.plantilla.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {(() => {
                      const names = a.respuestas.map(r => `${r.employee.apellido}, ${r.employee.nombre}`)
                      if (names.length === 0) return '—'
                      if (names.length <= 2) return names.join(' · ')
                      return `${names.slice(0, 2).join(' · ')} y ${names.length - 2} más`
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-xs font-medium',
                      a.enviadas === a._count.respuestas ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    )}>
                      {a.enviadas}/{a._count.respuestas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {a.fechaLimite ? new Date(a.fechaLimite).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {new Date(a.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(a)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setToDelete(a)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={toEdit !== null} onOpenChange={v => !v && setToEdit(null)}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar solicitud</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre</p>
              <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plantilla</p>
              <Select value={editPlantillaId} onValueChange={v => { if (v) { setEditPlantillaId(v); setEditDatosAdmin({}) } }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una plantilla" /></SelectTrigger>
                <SelectContent>
                  {plantillas.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {toEdit && editPlantillaId !== String(toEdit.plantillaId) && toEdit.enviadas > 0 && (
                <div className="flex items-start gap-2 mt-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>Cambiar la plantilla reiniciará las respuestas ya enviadas por los empleados.</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fecha límite (opcional)</p>
              <Input type="date" value={editFechaLimite} onChange={e => setEditFechaLimite(e.target.value)} />
            </div>
            {(() => {
              const plantilla = plantillas.find(p => p.id === Number(editPlantillaId))
              const camposAdmin = plantilla?.campos.filter(c => c.rellena === 'admin') ?? []
              if (!plantilla || camposAdmin.length === 0) return null
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Campos pre-cargados por RRHH</p>
                  {camposAdmin.map(campo => (
                    <div key={campo.nombre}>
                      <p className="text-xs text-muted-foreground mb-1">{campo.label} <span className="italic">(opcional)</span></p>
                      {campo.tipo === 'texto' ? (
                        <Textarea className="text-sm min-h-[60px]" placeholder={`${campo.label}...`}
                          value={editDatosAdmin[campo.nombre] ?? ''}
                          onChange={e => setEditDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))} />
                      ) : (
                        <Input type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                          placeholder={campo.label}
                          value={editDatosAdmin[campo.nombre] ?? ''}
                          onChange={e => setEditDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setToEdit(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleEdit} disabled={editSaving}>
              {editSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={v => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar solicitud?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Se eliminarán todas las respuestas de <span className="font-medium text-foreground">"{toDelete?.nombre}"</span>. Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nueva solicitud</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre de la solicitud</p>
              <Input placeholder="Ej: Alta de haberes — Junio 2026" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plantilla</p>
              <Select value={plantillaId} onValueChange={v => { if (v) { setPlantillaId(v); setDatosAdmin({}) } }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una plantilla" /></SelectTrigger>
                <SelectContent>
                  {plantillas.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fecha límite (opcional)</p>
              <Input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} />
            </div>
            {(() => {
              const plantilla = plantillas.find(p => p.id === Number(plantillaId))
              const camposAdmin = plantilla?.campos.filter(c => c.rellena === 'admin') ?? []
              if (!plantilla || camposAdmin.length === 0) return null
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Campos pre-cargados por RRHH</p>
                  {camposAdmin.map(campo => (
                    <div key={campo.nombre}>
                      <p className="text-xs text-muted-foreground mb-1">{campo.label} <span className="italic">(opcional — el empleado lo verá como solo lectura)</span></p>
                      {campo.tipo === 'texto' ? (
                        <Textarea
                          className="text-sm min-h-[60px]"
                          placeholder={`${campo.label}...`}
                          value={datosAdmin[campo.nombre] ?? ''}
                          onChange={e => setDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                          placeholder={campo.label}
                          value={datosAdmin[campo.nombre] ?? ''}
                          onChange={e => setDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Empleados · <span className="font-medium">{selected.length} seleccionado{selected.length !== 1 ? 's' : ''}</span>
              </p>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {filtered.length > 0 && (
                <button
                  className="text-xs text-green-700 dark:text-green-400 mb-2 flex items-center gap-1 hover:underline"
                  onClick={toggleAll}
                >
                  {filtered.every(e => selected.includes(e.id)) ? <CheckSquare size={13} /> : <Square size={13} />}
                  {filtered.every(e => selected.includes(e.id)) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
              <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>}
                {filtered.map(e => (
                  <label key={e.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() => toggleEmpleado(e.id)}
                      className="w-4 h-4 accent-green-700 shrink-0"
                    />
                    <span className="text-sm">{e.apellido}, {e.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.legajo}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleCrear} disabled={saving}>
              {saving ? 'Solicitando...' : 'Solicitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
