'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface UserLite {
  id: number
  email: string
  role: string
  employee: { apellido: string; nombre: string; legajo: string; categoria?: { nombre: string } | null } | null
}

interface Props {
  open: boolean
  managerId: number
  managerLabel: string
  onClose: () => void
  onSaved?: () => void
}

export function SubordinadosDialog({ open, managerId, managerLabel, onClose, onSaved }: Props) {
  const [users, setUsers] = useState<UserLite[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setFilter('')
    Promise.all([
      fetch('/api/usuarios').then(r => r.text()),
      fetch(`/api/usuarios/${managerId}/subordinados`).then(r => r.text()),
    ]).then(([todosTxt, actualesTxt]) => {
      let todos: unknown = []
      let actuales: { subordinadoIds?: number[] } = {}
      try { todos = JSON.parse(todosTxt) } catch { toast.error('Error cargando usuarios'); return }
      try { actuales = JSON.parse(actualesTxt) } catch {
        toast.error('Error cargando subordinados — corré prisma migrate + generate y reiniciá el server')
        return
      }
      setUsers(Array.isArray(todos) ? (todos as UserLite[]).filter(u => u.id !== managerId && !!u.employee) : [])
      setSelected(new Set(actuales.subordinadoIds ?? []))
    }).finally(() => setLoading(false))
  }, [open, managerId])

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch(`/api/usuarios/${managerId}/subordinados`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subordinadoIds: [...selected] }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(data.error ?? 'Error al guardar'); return }
      toast.success('Organigrama actualizado')
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const filtered = users.filter(u => {
    if (!filter) return true
    const q = filter.toLowerCase()
    const label = u.employee
      ? `${u.employee.apellido} ${u.employee.nombre} ${u.employee.legajo} ${u.email}`
      : u.email
    return label.toLowerCase().includes(q)
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Subordinados de {managerLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={users.length > 0 && selected.size === users.length}
              onCheckedChange={v => {
                if (v) setSelected(new Set(users.map(u => u.id)))
                else setSelected(new Set())
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
            ) : filtered.map(u => {
              const checked = selected.has(u.id)
              const label = u.employee
                ? `${u.employee.apellido}, ${u.employee.nombre}`
                : u.email
              const sub = u.employee ? u.employee.legajo : 'Admin sin legajo'
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => setSelected(prev => {
                      const next = new Set(prev)
                      if (v) next.add(u.id); else next.delete(u.id)
                      return next
                    })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate">{label}</p>
                      <span className={cn(
                        'text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
                        u.role === 'ADMIN'
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {u.role === 'ADMIN' ? 'Admin' : 'Empleado'}
                      </span>
                      {u.employee?.categoria?.nombre && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground shrink-0">
                          {u.employee.categoria.nombre}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
                  </div>
                </label>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Marcá quién tiene un orden jerárquico inferior a este usuario. Se evita cualquier ciclo automáticamente.
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
