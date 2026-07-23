'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface UserLite {
  id: number
  email: string
  employee: { apellido: string; nombre: string; legajo: string } | null
}

interface Props {
  open: boolean
  userId: number
  userLabel: string
  onClose: () => void
  onSaved?: () => void
}

export function ManagerDialog({ open, userId, userLabel, onClose, onSaved }: Props) {
  const [users, setUsers] = useState<UserLite[]>([])
  const [managerActualId, setManagerActualId] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setFilter('')
    Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch(`/api/usuarios/${userId}/manager`).then(r => r.json()),
    ]).then(([todos, actual]) => {
      const list: UserLite[] = Array.isArray(todos)
        ? (todos as UserLite[]).filter(u => u.id !== userId && !!u.employee)
        : []
      setUsers(list)
      setManagerActualId(actual?.managerUserId ?? null)
      setSelected(actual?.managerUserId ?? null)
    }).catch(() => toast.error('Error cargando datos'))
      .finally(() => setLoading(false))
  }, [open, userId])

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch(`/api/usuarios/${userId}/manager`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerUserId: selected }),
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
          <DialogTitle>Superior de {userLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Buscar…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>
            {selected !== null && (
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setSelected(null)}>
                <X size={12} /> Quitar
              </Button>
            )}
          </div>

          <div className="border border-border rounded-md overflow-y-auto flex-1">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
            ) : filtered.map(u => {
              const checked = selected === u.id
              const label = u.employee ? `${u.employee.apellido}, ${u.employee.nombre}` : u.email
              const sub = u.employee ? u.employee.legajo : 'Admin sin legajo'
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setSelected(u.id)}
                  className={cn(
                    'w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border last:border-0 transition-colors',
                    checked ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-muted/40'
                  )}
                >
                  <input type="radio" checked={checked} readOnly className="w-3.5 h-3.5 accent-green-700" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Elegí a quién reporta este empleado. Sin selección queda en la cima del organigrama (y sus solicitudes se auto-aprueban).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleSave}
            disabled={saving || loading || selected === managerActualId}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
