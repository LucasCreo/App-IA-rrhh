'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: 'destructive' | 'default'
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Eliminar', confirmVariant = 'destructive',
  cancelLabel = 'Cancelar',
  onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={confirmVariant}
            className={confirmVariant === 'default' ? 'bg-green-700 hover:bg-green-800' : ''}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
