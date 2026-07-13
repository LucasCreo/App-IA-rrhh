'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Categoria {
  id: number
  nombre: string
  nivel?: number | null
  rolPorDefecto?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categoria?: Categoria
}

export function CategoriaDialog({ open, onClose, onSaved, categoria }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [nivel, setNivel] = useState<string>(categoria?.nivel != null ? String(categoria.nivel) : '')
  const [rolPorDefecto, setRolPorDefecto] = useState<string>(categoria?.rolPorDefecto ?? '__none__')

  async function handleSave() {
    const url = categoria ? `/api/categorias/${categoria.id}` : '/api/categorias'
    const method = categoria ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        nivel: nivel.trim() === '' ? null : Number(nivel),
        rolPorDefecto: rolPorDefecto === '__none__' ? null : rolPorDefecto,
      }),
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
        <div className="space-y-4 py-2">
          <div>
            <Label>Nombre</Label>
            <Input className="mt-1" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Operario" />
          </div>
          <div>
            <Label>Nivel jerárquico <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={99}
              value={nivel}
              onChange={e => setNivel(e.target.value)}
              placeholder="1 = tope, 2 = gerencia, 3 = jefatura, 4 = operativo…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Menor número = más alto en la jerarquía. Se usa para validar quién puede estar a cargo de quién.
            </p>
          </div>
          <div>
            <Label>Rol sugerido al crear usuario <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={rolPorDefecto} onValueChange={v => setRolPorDefecto(v || '__none__')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sin sugerencia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin sugerencia</SelectItem>
                <SelectItem value="ADMIN">Admin (acceso al panel de gestión)</SelectItem>
                <SelectItem value="EMPLOYEE">Empleado (solo portal personal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
