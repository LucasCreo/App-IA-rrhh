'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategoriasTable, type CategoriasTableHandle } from '@/components/categorias/CategoriasTable'
import { AreasTable, type AreasTableHandle } from '@/components/areas/AreasTable'
import { Plus } from 'lucide-react'

const LABELS: Record<string, string> = {
  legajo: 'Legajo', cuil: 'CUIL', email: 'Email',
  telefono: 'Teléfono', fechaIngreso: 'Fecha de Ingreso',
  categoria: 'Categoría', estado: 'Estado',
}

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'booleano', label: 'Booleano' },
  { value: 'archivo', label: 'Archivo' },
]

interface FieldConfig { campo: string; visible: boolean; requerido: boolean; eliminado: boolean; visibleEnAlta: boolean }
interface CampoPersonalizado { id: number; nombre: string; tipo: string; visible: boolean; requerido: boolean; visibleEnAlta: boolean }
interface PendingDelete { id: number; nombre: string; count: number }

export function TabEmpleados() {
  const categoriasRef = useRef<CategoriasTableHandle>(null)
  const areasRef = useRef<AreasTableHandle>(null)
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [camposCustom, setCamposCustom] = useState<CampoPersonalizado[]>([])
  const [showFormCampo, setShowFormCampo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('texto')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  useEffect(() => {
    fetch('/api/configuracion/empleados-campos').then(r => r.json()).then(setFields)
    fetch('/api/configuracion/campos-personalizados').then(r => r.json()).then(setCamposCustom)
  }, [])

  function toggle(campo: string, key: 'visible' | 'requerido' | 'visibleEnAlta') {
    setFields(fs => fs.map(f => {
      if (f.campo !== campo) return f
      const updated = { ...f, [key]: !f[key] }
      if (key === 'visible' && !updated.visible) { updated.requerido = false; updated.visibleEnAlta = false }
      if (key === 'visibleEnAlta' && !updated.visibleEnAlta) updated.requerido = false
      return updated
    }))
  }

  async function save(updated: FieldConfig[]) {
    await fetch('/api/configuracion/empleados-campos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  async function handleSave() {
    await save(fields)
    toast.success('Configuración guardada')
  }

  async function handleEliminarDefault(campo: string) {
    const updated = fields.map(f => f.campo === campo ? { ...f, eliminado: true, visible: false, requerido: false } : f)
    setFields(updated)
    await save(updated)
    toast.success('Campo eliminado')
  }

  async function handleRestaurarDefault(campo: string) {
    const updated = fields.map(f => f.campo === campo ? { ...f, eliminado: false, visible: true } : f)
    setFields(updated)
    await save(updated)
    toast.success('Campo restaurado')
  }

  async function toggleCustom(id: number, key: 'visible' | 'requerido' | 'visibleEnAlta', value: boolean) {
    const campo = camposCustom.find(c => c.id === id)!
    const updated = { ...campo, [key]: value }
    if (key === 'visible' && !value) { updated.requerido = false; updated.visibleEnAlta = false }
    if (key === 'visibleEnAlta' && !value) updated.requerido = false
    setCamposCustom(cs => cs.map(c => c.id === id ? updated : c))
    await fetch(`/api/configuracion/campos-personalizados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: updated.visible, requerido: updated.requerido, visibleEnAlta: updated.visibleEnAlta }),
    })
  }

  async function handleAgregar() {
    if (!nuevoNombre.trim()) return toast.error('Ingresá un nombre para el campo')
    const res = await fetch('/api/configuracion/campos-personalizados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), tipo: nuevoTipo }),
    })
    if (!res.ok) { toast.error('Ya existe un campo con ese nombre'); return }
    const nuevo = await res.json()
    setCamposCustom(cs => [...cs, nuevo])
    setNuevoNombre('')
    setNuevoTipo('texto')
    setShowFormCampo(false)
    toast.success('Campo agregado')
  }

  async function handleEliminar(id: number, confirmar = false) {
    const url = `/api/configuracion/campos-personalizados/${id}${confirmar ? '?confirmar=true' : ''}`
    const res = await fetch(url, { method: 'DELETE' })
    const data = await res.json()
    if (data.requiresConfirmation) {
      const campo = camposCustom.find(c => c.id === id)!
      setPendingDelete({ id, nombre: campo.nombre, count: data.count })
      return
    }
    setCamposCustom(cs => cs.filter(c => c.id !== id))
    toast.success('Campo eliminado')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campos del módulo Personal</CardTitle>
          <CardDescription>Configurá qué campos se muestran y cuáles son obligatorios.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Campo</th>
                  <th className="text-center px-4 py-2 font-medium">Visible</th>
                  <th className="text-center px-4 py-2 font-medium" title="Aparece en el formulario al crear un nuevo legajo. Si está apagado, el campo solo se muestra al editar el empleado.">En alta</th>
                  <th className="text-center px-4 py-2 font-medium">Requerido</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(['nombre', 'apellido'] as const).map(f => (
                  <tr key={f} className="border-t bg-muted/30">
                    <td className="px-4 py-2 text-muted-foreground capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</td>
                    <td className="text-center px-4 py-2"><input type="checkbox" checked readOnly className="w-4 h-4 opacity-50" /></td>
                    <td className="text-center px-4 py-2"><input type="checkbox" checked readOnly className="w-4 h-4 opacity-50" /></td>
                    <td className="text-center px-4 py-2"><input type="checkbox" checked readOnly className="w-4 h-4 opacity-50" /></td>
                    <td />
                  </tr>
                ))}
                {fields.filter(f => !f.eliminado).map(f => (
                  <tr key={f.campo} className="border-t">
                    <td className="px-4 py-2 font-medium">{LABELS[f.campo] ?? f.campo}</td>
                    <td className="text-center px-4 py-2">
                      <input type="checkbox" checked={f.visible} onChange={() => toggle(f.campo, 'visible')} className="w-4 h-4 accent-green-700" />
                    </td>
                    <td className="text-center px-4 py-2">
                      <input type="checkbox" checked={f.visibleEnAlta} onChange={() => toggle(f.campo, 'visibleEnAlta')} disabled={!f.visible} className="w-4 h-4 accent-green-700 disabled:opacity-30" />
                    </td>
                    <td className="text-center px-4 py-2">
                      <input type="checkbox" checked={f.requerido} onChange={() => toggle(f.campo, 'requerido')} disabled={!f.visible || !f.visibleEnAlta} className="w-4 h-4 accent-green-700 disabled:opacity-30" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleEliminarDefault(f.campo)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fields.some(f => f.eliminado) && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Campos eliminados</p>
              <div className="flex flex-wrap gap-2">
                {fields.filter(f => f.eliminado).map(f => (
                  <div key={f.campo} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 text-xs">
                    <span>{LABELS[f.campo] ?? f.campo}</span>
                    <button onClick={() => handleRestaurarDefault(f.campo)} className="text-green-700 hover:text-green-900 font-medium">Restaurar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-3">Nombre y Apellido siempre son visibles y requeridos.</p>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Campos personalizados</CardTitle>
              <CardDescription className="mt-1">Agregá campos extra al formulario de empleados.</CardDescription>
            </div>
            {!showFormCampo && (
              <Button size="sm" className="bg-green-700 hover:bg-green-800 shrink-0" onClick={() => setShowFormCampo(true)}>
                <Plus size={14} className="mr-1" /> Nuevo campo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {camposCustom.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Campo</th>
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-center px-4 py-2 font-medium">Visible</th>
                    <th className="text-center px-4 py-2 font-medium" title="Aparece en el formulario al crear un nuevo legajo. Si está apagado, el campo solo se muestra al editar el empleado, dentro de 'Información adicional'.">En alta</th>
                    <th className="text-center px-4 py-2 font-medium">Requerido</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {camposCustom.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{c.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground capitalize">{TIPOS.find(t => t.value === c.tipo)?.label ?? c.tipo}</td>
                      <td className="text-center px-4 py-2">
                        <input type="checkbox" checked={c.visible} onChange={() => toggleCustom(c.id, 'visible', !c.visible)} className="w-4 h-4 accent-green-700" />
                      </td>
                      <td className="text-center px-4 py-2">
                        <input type="checkbox" checked={c.visibleEnAlta} onChange={() => toggleCustom(c.id, 'visibleEnAlta', !c.visibleEnAlta)} disabled={!c.visible} className="w-4 h-4 accent-green-700 disabled:opacity-30" />
                      </td>
                      <td className="text-center px-4 py-2">
                        <input type="checkbox" checked={c.requerido} onChange={() => toggleCustom(c.id, 'requerido', !c.requerido)} disabled={!c.visible || !c.visibleEnAlta} className="w-4 h-4 accent-green-700 disabled:opacity-30" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleEliminar(c.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showFormCampo && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="text-xs text-muted-foreground mb-1">Nombre del campo</p>
                  <Input
                    placeholder="Ej: Número de obra social"
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAgregar()}
                    autoFocus
                  />
                </div>
                <div className="w-36">
                  <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                  <Select value={nuevoTipo} onValueChange={v => v && setNuevoTipo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowFormCampo(false); setNuevoNombre(''); setNuevoTipo('texto') }}>Cancelar</Button>
                <Button className="bg-green-700 hover:bg-green-800" size="sm" onClick={handleAgregar}>Agregar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Áreas</CardTitle>
              <CardDescription>Definí las áreas o departamentos de la empresa.</CardDescription>
            </div>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 shrink-0"
              onClick={() => areasRef.current?.openNew()}
            >
              <Plus size={14} className="mr-1" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AreasTable ref={areasRef} showTopButton={false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Categorías</CardTitle>
              <CardDescription>Definí las categorías laborales, transversales a las áreas.</CardDescription>
            </div>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 shrink-0"
              onClick={() => categoriasRef.current?.openNew()}
            >
              <Plus size={14} className="mr-1" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CategoriasTable ref={categoriasRef} showTopButton={false} />
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campo "{pendingDelete?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.count} {pendingDelete?.count === 1 ? 'empleado tiene' : 'empleados tienen'} este campo relleno.
              Al eliminarlo se borrarán todos esos valores. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { handleEliminar(pendingDelete!.id, true); setPendingDelete(null) }}
            >
              Eliminar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
