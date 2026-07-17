'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Categoria {
  id: number
  nombre: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categoria?: Categoria
}

export function CategoriaDialog({ open, onClose, onSaved, categoria }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [error, setError] = useState('')

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setError('')
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
        <form onSubmit={e => { e.preventDefault(); handleSave() }}>
          <DialogHeader>
            <DialogTitle>{categoria ? 'Editar' : 'Nueva'} Categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5">Nombre <span className="text-red-500">*</span></Label>
              <Input className="mt-1" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Operario" autoFocus />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-green-700 hover:bg-green-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
