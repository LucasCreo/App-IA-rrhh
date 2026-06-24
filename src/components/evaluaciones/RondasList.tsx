'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Plantilla { id: number; nombre: string; activo: boolean }

interface Ronda {
  id: number
  nombre: string
  estado: string
  createdAt: string
  plantilla: { nombre: string }
  _count: { evaluaciones: number }
  completadas: number
}

interface Employee { id: number; nombre: string; apellido: string; legajo: string }

export function RondasList() {
  const router = useRouter()
  const [rondas, setRondas] = useState<Ronda[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [empleados, setEmpleados] = useState<Employee[]>([])
  const [nombre, setNombre] = useState('')
  const [plantillaId, setPlantillaId] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/evaluaciones/rondas').then(r => r.json()).then(setRondas).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openDialog() {
    setOpen(true)
    setNombre('')
    setPlantillaId('')
    setSeleccionados(new Set())
    setBusqueda('')
    Promise.all([
      fetch('/api/configuracion/plantillas-evaluacion').then(r => r.json()),
      fetch('/api/empleados?all=true').then(r => r.json()),
    ]).then(([ps, es]) => {
      setPlantillas((ps as Plantilla[]).filter(p => p.activo))
      setEmpleados((es as any).employees ?? es)
    })
  }

  function toggleEmpleado(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    const filtrados = empleadosFiltrados.map(e => e.id)
    const todosSelected = filtrados.every(id => seleccionados.has(id))
    setSeleccionados(prev => {
      const next = new Set(prev)
      filtrados.forEach(id => todosSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const empleadosFiltrados = empleados.filter(e =>
    `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function handleCrear() {
    if (!nombre.trim() || !plantillaId || seleccionados.size === 0) {
      toast.error('Completá todos los campos y seleccioná al menos un empleado')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/evaluaciones/rondas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, plantillaId: Number(plantillaId), employeeIds: Array.from(seleccionados) }),
      })
      if (!res.ok) { toast.error('Error al crear la ronda'); return }
      toast.success('Ronda creada')
      setOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Rondas de evaluación</h2>
        <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1" onClick={openDialog}>
          <Plus size={14} /> Nueva ronda
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : rondas.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">No hay rondas aún. Creá la primera.</p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {rondas.map(r => (
            <button
              key={r.id}
              onClick={() => router.push(`/admin/evaluaciones/${r.id}`)}
              className="w-full flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.nombre}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.plantilla.nombre}</span>
                  <Badge variant={r.estado === 'CERRADA' ? 'secondary' : 'outline'} className={cn('text-xs', r.estado === 'ACTIVA' && 'border-green-600 text-green-700 dark:text-green-400')}>
                    {r.estado === 'ACTIVA' ? 'Activa' : 'Cerrada'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.completadas} / {r._count.evaluaciones} evaluaciones completadas · {new Date(r.createdAt).toLocaleDateString('es-AR')}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[85vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nueva ronda de evaluación</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre de la ronda</p>
              <Input placeholder="Ej: Evaluación semestral 2025" value={nombre} onChange={e => setNombre(e.target.value)} />
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
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Empleados ({seleccionados.size} seleccionados)</p>
                {empleadosFiltrados.length > 0 && (
                  <button onClick={toggleTodos} className="text-xs text-green-700 hover:underline dark:text-green-400">
                    {empleadosFiltrados.every(e => seleccionados.has(e.id)) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              <Input
                placeholder="Buscar empleado…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {empleadosFiltrados.map(e => (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(e.id)}
                      onChange={() => toggleEmpleado(e.id)}
                      className="w-4 h-4 accent-green-700"
                    />
                    <span className="text-sm flex-1">{e.apellido}, {e.nombre}</span>
                    <span className="text-xs text-muted-foreground">{e.legajo}</span>
                  </label>
                ))}
                {empleadosFiltrados.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleCrear} disabled={saving}>
              {saving ? 'Creando…' : 'Crear ronda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
