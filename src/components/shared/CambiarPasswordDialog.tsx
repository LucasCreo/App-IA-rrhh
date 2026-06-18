'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { open: boolean; onClose: () => void }

export function CambiarPasswordDialog({ open, onClose }: Props) {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() { setCurrent(''); setNewPw(''); setConfirm('') }

  async function handleSubmit() {
    if (newPw !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    setLoading(true)
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Error al cambiar contraseña'); return }
    toast.success('Contraseña actualizada')
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Contraseña actual</Label>
            <Input type="password" className="mt-1" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div>
            <Label>Nueva contraseña</Label>
            <Input type="password" className="mt-1" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <div>
            <Label>Confirmar nueva contraseña</Label>
            <Input type="password" className="mt-1" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleSubmit}
            disabled={loading || !current || !newPw || !confirm}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
