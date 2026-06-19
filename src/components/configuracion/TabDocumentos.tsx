'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Plus, Check, X, Settings2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface CampoDefinicion {
  nombre: string
  label: string
  tipo: 'mes_anio' | 'texto' | 'numero' | 'fecha'
  requerido: boolean
}

interface Tipo {
  id: number
  nombre: string
  descripcion?: string | null
  accion: string
  campos?: CampoDefinicion[] | null
  tienePeriodo?: boolean
}

const ACCIONES: Record<string, string> = {
  FIRMA: 'Firma digital',
  LECTURA: 'Lectura',
  NINGUNA: 'Sin acción',
}

const TIPO_LABELS: Record<string, string> = {
  mes_anio: 'Mes/Año',
  texto: 'Texto',
  numero: 'Número',
  fecha: 'Fecha',
}

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function TabDocumentos() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [editing, setEditing] = useState<Tipo | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTipo, setNewTipo] = useState({ nombre: '', descripcion: '', accion: 'FIRMA' })
  const [camposDialog, setCamposDialog] = useState<{ tipo: Tipo; campos: CampoDefinicion[]; tienePeriodo: boolean } | null>(null)

  async function load() {
    const r = await fetch('/api/configuracion/tipos-documento')
    setTipos(await r.json())
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newTipo.nombre.trim()) return
    const res = await fetch('/api/configuracion/tipos-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTipo),
    })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error al crear'); return }
    setNewTipo({ nombre: '', descripcion: '', accion: 'FIRMA' })
    setAdding(false)
    load()
  }

  async function handleUpdate() {
    if (!editing) return
    const res = await fetch(`/api/configuracion/tipos-documento/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error al guardar'); return }
    setEditing(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar tipo? Los documentos asociados quedarán sin tipo.')) return
    const res = await fetch(`/api/configuracion/tipos-documento/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error al eliminar'); return }
    load()
  }

  function openCamposDialog(tipo: Tipo) {
    setCamposDialog({ tipo, campos: tipo.campos ? [...tipo.campos] : [], tienePeriodo: tipo.tienePeriodo !== false })
  }

  function addCampo() {
    setCamposDialog(prev => prev ? {
      ...prev,
      campos: [...prev.campos, { nombre: '', label: '', tipo: 'texto', requerido: false }],
    } : prev)
  }

  function removeCampo(i: number) {
    setCamposDialog(prev => prev ? { ...prev, campos: prev.campos.filter((_, idx) => idx !== i) } : prev)
  }

  function updateCampoLabel(i: number, label: string) {
    setCamposDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], label, nombre: slugify(label) }
      return { ...prev, campos }
    })
  }

  function updateCampoTipo(i: number, tipo: CampoDefinicion['tipo']) {
    setCamposDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], tipo }
      return { ...prev, campos }
    })
  }

  function updateCampoRequerido(i: number, requerido: boolean) {
    setCamposDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], requerido }
      return { ...prev, campos }
    })
  }

  async function saveCampos() {
    if (!camposDialog) return
    await fetch(`/api/configuracion/tipos-documento/${camposDialog.tipo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...camposDialog.tipo, campos: camposDialog.campos, tienePeriodo: camposDialog.tienePeriodo }),
    })
    setCamposDialog(null)
    load()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Documento</CardTitle>
          <CardDescription>Categorías para clasificar los documentos al subirlos. Configurá los campos que se pedirán al cargar cada tipo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium">Descripción</th>
                  <th className="text-left px-4 py-2 font-medium w-36">Acción</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {tipos.length === 0 && !adding && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sin tipos definidos</td></tr>
                )}
                {tipos.map(tipo => (
                  <tr key={tipo.id} className="border-t">
                    {editing?.id === tipo.id ? (
                      <>
                        <td className="px-3 py-1.5">
                          <Input value={editing.nombre} onChange={e => setEditing(t => t ? { ...t, nombre: e.target.value } : t)} className="h-7 text-sm" />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input value={editing.descripcion ?? ''} onChange={e => setEditing(t => t ? { ...t, descripcion: e.target.value } : t)} className="h-7 text-sm" />
                        </td>
                        <td className="px-3 py-1.5">
                          <Select value={editing.accion} onValueChange={v => setEditing(t => t ? { ...t, accion: v } : t)}>
                            <SelectTrigger className="h-7 text-sm w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(ACCIONES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5 text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={handleUpdate}><Check size={13} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X size={13} /></Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-medium">{tipo.nombre}</td>
                        <td className="px-4 py-2 text-muted-foreground">{tipo.descripcion ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{ACCIONES[tipo.accion] ?? tipo.accion}</td>
                        <td className="px-4 py-2 text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Configurar campos"
                            onClick={() => openCamposDialog(tipo)}
                          >
                            <Settings2 size={13} />
                            {tipo.campos?.length ? (
                              <span className="ml-1 text-xs text-muted-foreground">{tipo.campos.length}</span>
                            ) : null}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(tipo)}><Pencil size={13} /></Button>
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(tipo.id)}><Trash2 size={13} /></Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {adding && (
                  <tr className="border-t bg-green-50 dark:bg-green-950/20">
                    <td className="px-3 py-1.5">
                      <Input value={newTipo.nombre} onChange={e => setNewTipo(t => ({ ...t, nombre: e.target.value }))} placeholder="Nombre del tipo" className="h-7 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input value={newTipo.descripcion} onChange={e => setNewTipo(t => ({ ...t, descripcion: e.target.value }))} placeholder="Descripción (opcional)" className="h-7 text-sm" />
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={newTipo.accion} onValueChange={v => setNewTipo(t => ({ ...t, accion: v }))}>
                        <SelectTrigger className="h-7 text-sm w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACCIONES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={handleAdd}><Check size={13} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X size={13} /></Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button variant="outline" className="border-green-700 text-green-700 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950/20" onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={15} className="mr-1" /> Nuevo Tipo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!camposDialog} onOpenChange={open => { if (!open) setCamposDialog(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Campos de "{camposDialog?.tipo.nombre}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Solicitar período (Mes/Año)</p>
                <p className="text-xs text-muted-foreground">Activalo para pedir mes y año al cargar este tipo de documento.</p>
              </div>
              <Switch
                checked={camposDialog?.tienePeriodo ?? true}
                onCheckedChange={v => setCamposDialog(prev => prev ? { ...prev, tienePeriodo: v } : prev)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Campos adicionales que se pedirán al subir un documento de este tipo.
            </p>
            {camposDialog?.campos.length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-3 border rounded-md">
                Sin campos definidos — se usará el período por defecto.
              </p>
            )}
            {camposDialog?.campos.map((campo, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={campo.label}
                  onChange={e => updateCampoLabel(i, e.target.value)}
                  placeholder="Etiqueta del campo"
                  className="h-8 text-sm flex-1"
                />
                <Select value={campo.tipo} onValueChange={v => updateCampoTipo(i, v as CampoDefinicion['tipo'])}>
                  <SelectTrigger className="w-28 h-8 text-sm shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Req.</span>
                  <Switch checked={campo.requerido} onCheckedChange={v => updateCampoRequerido(i, v)} />
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive shrink-0" onClick={() => removeCampo(i)}>
                  <X size={13} />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCampo}>
              <Plus size={13} className="mr-1" /> Agregar campo
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCamposDialog(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={saveCampos}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
