'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search, Lock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface Props {
  open: boolean
  loteId: number
  onClose: () => void
  onSaved: () => void
}

export function EditarRosterDialog({ open, loteId, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bloqueados, setBloqueados] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setFilter('')
    setLoading(true)
    Promise.all([
      fetch('/api/empleados?all=true&estado=ACTIVO').then(r => r.json()),
      fetch(`/api/lotes/${loteId}`).then(r => r.json()),
    ]).then(([emps, lote]) => {
      setEmpleados(emps.employees ?? [])
      const empsEnLote: any[] = lote.empleados ?? []
      setSelected(new Set(empsEnLote.map((e: any) => e.id)))
      setBloqueados(new Set(empsEnLote.filter((e: any) => e.documento).map((e: any) => e.id)))
    }).finally(() => setLoading(false))
  }, [open, loteId])

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch(`/api/lotes/${loteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: [...selected] }),
      })
      if (!r.ok) { toast.error('Error al guardar el roster'); return }
      toast.success('Roster actualizado')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const filtered = empleados.filter(e => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase().includes(q)
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Editar empleados del lote</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={empleados.length > 0 && selected.size === empleados.length}
              onCheckedChange={v => {
                if (v) setSelected(new Set(empleados.map(e => e.id)))
                else setSelected(new Set(bloqueados))
              }}
            />
            <Label className="text-xs">Todos</Label>
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Buscar…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{selected.size} sel.</span>
          </div>

          <div className="border border-border rounded-md overflow-y-auto flex-1">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
            ) : filtered.map(emp => {
              const checked = selected.has(emp.id)
              const locked = bloqueados.has(emp.id)
              return (
                <label
                  key={emp.id}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border last:border-0 ${locked ? 'opacity-60' : 'hover:bg-muted/40 cursor-pointer'}`}
                  title={locked ? 'Tiene recibo cargado — no se puede quitar' : undefined}
                >
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={v => setSelected(prev => {
                      const next = new Set(prev)
                      if (v) next.add(emp.id); else next.delete(emp.id)
                      return next
                    })}
                  />
                  <span className="font-mono text-muted-foreground shrink-0">{emp.legajo}</span>
                  <span className="truncate flex-1">{emp.apellido}, {emp.nombre}</span>
                  {locked && <Lock size={11} className="text-muted-foreground shrink-0" />}
                </label>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Los empleados con recibo cargado no se pueden quitar del lote.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
