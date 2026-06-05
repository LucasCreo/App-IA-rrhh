'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categoria?: { id: number; nombre: string }
}

export function CategoriaDialog({ open, onClose, onSaved, categoria }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')

  async function handleSave() {
    const url = categoria ? `/api/categorias/${categoria.id}` : '/api/categorias'
    const method = categoria ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar' : 'Nueva'} Categoría</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Operario" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
