'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ClipboardList, Plus, Search, CheckSquare, Square } from 'lucide-react'

interface Asignacion {
  id: number
  nombre: string
  plantilla: { nombre: string }
  fechaLimite: string | null
  createdAt: string
  _count: { respuestas: number }
  enviadas: number
}

interface Plantilla { id: number; nombre: string; activo: boolean }
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
    setNombre(''); setPlantillaId(''); setFechaLimite(''); setSearch(''); setSelected([])
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

  async function handleCrear() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre'); return }
    if (!plantillaId) { toast.error('Seleccioná una plantilla'); return }
    if (selected.length === 0) { toast.error('Seleccioná al menos un empleado'); return }
    setSaving(true)
    const res = await fetch('/api/formularios/asignaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, plantillaId: Number(plantillaId), fechaLimite: fechaLimite || null, employeeIds: selected }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Error'); return }
    setOpen(false); load()
    toast.success('Formulario asignado')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{asignaciones.length} asignación{asignaciones.length !== 1 ? 'es' : ''}</p>
        <Button className="bg-green-700 hover:bg-green-800 gap-1.5" onClick={openDialog}>
          <Plus size={15} /> Nueva asignación
        </Button>
      </div>

      {asignaciones.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin formularios asignados todavía</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Plantilla</th>
                <th className="text-center px-4 py-2.5 font-medium">Progreso</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Fecha límite</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Creada</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nueva asignación de formulario</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre de la asignación</p>
              <Input placeholder="Ej: Alta de haberes — Junio 2026" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plantilla</p>
              <Select value={plantillaId} onValueChange={v => v && setPlantillaId(v)}>
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
              {saving ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
