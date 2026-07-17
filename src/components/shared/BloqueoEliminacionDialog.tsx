'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Dependencia { label: string; count: number; href: string }

interface Props {
  open: boolean
  onClose: () => void
  title: string
  dependencias: Dependencia[]
  suggest?: string
  /** URL del endpoint DELETE. Si se pasa, muestra el botón "Eliminar todo" que llama con ?force=true. */
  forceDeleteUrl?: string
  /** Texto que el usuario debe tipear para confirmar (email o legajo). */
  confirmToken?: string
  onDeleted?: () => void
}

export function BloqueoEliminacionDialog({
  open, onClose, title, dependencias, suggest, forceDeleteUrl, confirmToken, onDeleted,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const totalItems = dependencias.reduce((a, b) => a + b.count, 0)

  useEffect(() => {
    if (!open) { setConfirmOpen(false); setTyped(''); setDeleting(false) }
  }, [open])

  async function handleForceDelete() {
    if (!forceDeleteUrl) return
    setDeleting(true)
    try {
      const sep = forceDeleteUrl.includes('?') ? '&' : '?'
      const r = await fetch(`${forceDeleteUrl}${sep}force=true`, { method: 'DELETE' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? 'Error al eliminar')
        return
      }
      toast.success('Eliminado por completo')
      setConfirmOpen(false)
      onClose()
      onDeleted?.()
    } finally {
      setDeleting(false)
    }
  }

  const canConfirm = !!confirmToken && typed === confirmToken

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={v => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Existen datos asociados. Podés eliminarlos manualmente desde cada sección,
              o eliminar todo de una en cascada.
              {suggest && <> {suggest}</>}
            </p>
            <ul className="space-y-1.5">
              {dependencias.map(d => (
                <li key={d.label} className="flex items-center justify-between text-sm border rounded-md px-3 py-2 bg-muted/30">
                  <span>{d.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-background border rounded px-1.5 py-0.5">{d.count}</span>
                    <a href={d.href} className="text-xs text-green-700 dark:text-green-400 hover:underline">Ir</a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {forceDeleteUrl && confirmToken && (
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 sm:mr-auto"
                onClick={() => setConfirmOpen(true)}
              >
                <AlertTriangle size={14} className="mr-1.5" />
                Eliminar todo ({totalItems})
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {forceDeleteUrl && confirmToken && (
        <Dialog open={confirmOpen} onOpenChange={v => { if (!v && !deleting) setConfirmOpen(false) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle size={18} /> Eliminación irreversible
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm">
                Vas a eliminar <strong>{totalItems}</strong> registros asociados, además del usuario y/o legajo.
                Esto no se puede deshacer.
              </p>
              <div>
                <Label className="mb-1.5">
                  Para confirmar, tipeá <code className="text-xs bg-muted px-1 py-0.5 rounded">{confirmToken}</code>
                </Label>
                <Input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={confirmToken}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleForceDelete}
                disabled={!canConfirm || deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar todo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
