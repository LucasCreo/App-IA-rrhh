'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TODOS_LOS_PERMISOS, LABELS_PERMISOS, type Permiso } from '@/lib/permissions'

interface Props {
  open: boolean
  userId: number
  userLabel: string
  initialPermisos: string[]
  onClose: () => void
  onSaved: () => void
}

export function PermisosDialog({
  open, userId, userLabel, initialPermisos, onClose, onSaved,
}: Props) {
  const [permisos, setPermisos] = useState<Set<string>>(new Set(initialPermisos))
  const [saving, setSaving] = useState(false)

  const accesoTotal = permisos.size === 0

  function toggle(p: string) {
    setPermisos(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch(`/api/usuarios/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos: [...permisos] }),
      })
      if (!r.ok) { toast.error('Error al guardar'); return }
      toast.success('Permisos actualizados')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Permisos de {userLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p>Sin ningún permiso marcado, el usuario tiene <strong className="text-foreground">acceso total</strong> a los módulos.</p>
            <p>El <strong className="text-foreground">alcance sobre empleados</strong> queda determinado automáticamente por el organigrama: solo ve/edita a sí mismo y sus subordinados. Los admins sin legajo (soporte) ven todo.</p>
          </div>

          <div>
            <Label className="mb-2 text-xs">
              Permisos ({permisos.size} de {TODOS_LOS_PERMISOS.length}){accesoTotal && ' — acceso total'}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TODOS_LOS_PERMISOS.map(p => {
                const checked = permisos.has(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(p)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                      checked
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                        : 'border-border hover:border-muted-foreground text-muted-foreground'
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 rounded flex items-center justify-center shrink-0',
                      checked ? 'bg-green-600' : 'border border-muted-foreground'
                    )}>
                      {checked && <Check size={10} className="text-white" />}
                    </div>
                    <span className="flex-1">{LABELS_PERMISOS[p as Permiso] ?? p}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
