'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Categoria { id: number; nombre: string }
interface Empleado {
  id?: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; categoriaId: number; estado: string
}
interface FieldConfig { campo: string; visible: boolean; requerido: boolean }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; empleado?: Empleado }

const empty: Empleado = {
  legajo: '', nombre: '', apellido: '', cuil: '', email: '',
  telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO',
}

const TEXT_FIELDS: Array<[keyof Empleado, string]> = [
  ['legajo', 'Legajo'], ['cuil', 'CUIL'], ['email', 'Email'], ['telefono', 'Teléfono'],
]

export function EmpleadoDialog({ open, onClose, onSaved, empleado }: Props) {
  const [form, setForm] = useState<Empleado>(empleado ?? empty)
  const [cats, setCats] = useState<Categoria[]>([])
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/categorias').then(r => r.json()).then(setCats)
    fetch('/api/configuracion/empleados-campos').then(r => r.json()).then(setFieldConfig)
    setForm(empleado ?? empty)
  }, [empleado, open])

  function isVisible(campo: string) {
    const cfg = fieldConfig.find(f => f.campo === campo)
    return cfg ? cfg.visible : true
  }

  function isRequired(campo: string) {
    const cfg = fieldConfig.find(f => f.campo === campo)
    return cfg ? cfg.requerido : false
  }

  const set = (k: keyof Empleado) => (val: string) => setForm(f => ({ ...f, [k]: val }))

  async function handleSave() {
    const url = form.id ? `/api/empleados/${form.id}` : '/api/empleados'
    const method = form.id ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) {
      const text = await res.text()
      toast.error(`Error al guardar: ${text}`)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar' : 'Nuevo'} Empleado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label>Nombre <span className="text-red-500">*</span></Label>
            <Input value={form.nombre} onChange={e => set('nombre')(e.target.value)} />
          </div>
          <div>
            <Label>Apellido <span className="text-red-500">*</span></Label>
            <Input value={form.apellido} onChange={e => set('apellido')(e.target.value)} />
          </div>
          {TEXT_FIELDS.filter(([k]) => isVisible(k as string)).map(([k, label]) => (
            <div key={k}>
              <Label>{label}{isRequired(k as string) && <span className="text-red-500 ml-1">*</span>}</Label>
              <Input value={(form[k] ?? '') as string} onChange={e => set(k)(e.target.value)} />
            </div>
          ))}
          {isVisible('fechaIngreso') && (
            <div>
              <Label>Fecha Ingreso{isRequired('fechaIngreso') && <span className="text-red-500 ml-1">*</span>}</Label>
              <Input type="date" value={form.fechaIngreso?.toString().slice(0, 10)} onChange={e => set('fechaIngreso')(e.target.value)} />
            </div>
          )}
          {isVisible('categoria') && (
            <div>
              <Label>Categoría{isRequired('categoria') && <span className="text-red-500 ml-1">*</span>}</Label>
              <Select key={cats.length} value={String(form.categoriaId)} onValueChange={v => v && set('categoriaId')(v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isVisible('estado') && (
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => v && set('estado')(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
