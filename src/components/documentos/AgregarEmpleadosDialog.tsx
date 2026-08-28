'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

interface Empleado {
  id: number
  nombre: string
  apellido: string
  legajo: string
  categoria?: { id: number; nombre: string } | null
}

interface Props {
  open: boolean
  grupoId: number
  yaAsignados: Set<number>
  onClose: () => void
  onSaved: () => void
}

export function AgregarEmpleadosDialog({ open, grupoId, yaAsignados, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelectedIds(new Set())
    setSearch('')
    setCategoriaId('')
    fetch('/api/empleados?all=true&estado=ACTIVO')
      .then(r => r.ok ? r.json() : null)
      .then((data: { employees?: Empleado[] } | Empleado[] | null) => {
        const list = Array.isArray(data) ? data : (data?.employees ?? [])
        setEmpleados(list)
      })
      .catch(() => setEmpleados([]))
      .finally(() => setLoading(false))
  }, [open])

  const disponibles = useMemo(
    () => empleados.filter(e => !yaAsignados.has(e.id)),
    [empleados, yaAsignados],
  )

  const categorias = useMemo(() => {
    const map = new Map<number, string>()
    disponibles.forEach(e => { if (e.categoria) map.set(e.categoria.id, e.categoria.nombre) })
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [disponibles])

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return disponibles.filter(e => {
      if (categoriaId && String(e.categoria?.id ?? '') !== categoriaId) return false
      if (!q) return true
      return `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase().includes(q)
    })
  }, [disponibles, search, categoriaId])

  const filteredIds = filtrados.map(e => e.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
  const someFilteredSelected = filteredIds.some(id => selectedIds.has(id)) && !allFilteredSelected

  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredIds.forEach(id => next.delete(id))
      else filteredIds.forEach(id => next.add(id))
      return next
    })
  }

  async function submit() {
    if (selectedIds.size === 0) { toast.error('Seleccioná al menos un empleado'); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/documentos-grupos/${grupoId}/asignaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: [...selectedIds] }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error ?? 'Error al agregar'); return }
      toast.success(`${d.added} empleado${d.added !== 1 ? 's' : ''} agregado${d.added !== 1 ? 's' : ''}${d.skipped > 0 ? ` (${d.skipped} ya estaba${d.skipped !== 1 ? 'n' : ''})` : ''}`)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !saving && onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Agregar empleados</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {loading ? 'Cargando…' : `${disponibles.length} disponible${disponibles.length !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400">
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por legajo o nombre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {categorias.length > 0 && (
              <Select value={categoriaId || 'todos'} onValueChange={v => setCategoriaId(!v || v === 'todos' ? '' : v)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorías</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="border rounded-lg overflow-hidden">
            <label className="flex items-center gap-2.5 px-3 py-2 border-b bg-muted/40 cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={el => { if (el) el.indeterminate = someFilteredSelected }}
                onChange={toggleAllFiltered}
                disabled={filteredIds.length === 0}
                className="accent-green-700"
              />
              <span className="text-xs font-medium">
                {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                {filtrados.length !== disponibles.length && ` (${filtrados.length})`}
              </span>
            </label>
            <div className="overflow-y-auto max-h-64">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando…</p>
              ) : filtrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {disponibles.length === 0
                    ? 'Todos los empleados activos ya están asignados.'
                    : 'Sin resultados'}
                </p>
              ) : filtrados.map(e => (
                <label
                  key={e.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(e.id)}
                    onChange={() => toggleOne(e.id)}
                    className="accent-green-700"
                  />
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{e.legajo}</span>
                  <span className="text-sm">{e.apellido}, {e.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={submit}
            disabled={saving || selectedIds.size === 0}
          >
            {saving ? 'Agregando…' : `Agregar ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
