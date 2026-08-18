'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Plus, Check, X, Lock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { handleApiError } from '@/lib/apiErrors'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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
  protegido?: boolean
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

interface EditState {
  tipo: Tipo
  nombre: string
  descripcion: string
  accion: string
  tienePeriodo: boolean
  campos: CampoDefinicion[]
}

export function TabDocumentos() {
  const router = useRouter()
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [adding, setAdding] = useState(false)
  const [newTipo, setNewTipo] = useState({ nombre: '', descripcion: '', accion: 'FIRMA' })
  const [editDialog, setEditDialog] = useState<EditState | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

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
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    setNewTipo({ nombre: '', descripcion: '', accion: 'FIRMA' })
    setAdding(false)
    load()
  }

  async function doDelete() {
    if (deleteId === null) return
    const res = await fetch(`/api/configuracion/tipos-documento/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    load()
  }

  function openEditDialog(tipo: Tipo) {
    setEditDialog({
      tipo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion ?? '',
      accion: tipo.accion,
      tienePeriodo: tipo.tienePeriodo !== false,
      campos: tipo.campos ? [...tipo.campos] : [],
    })
  }

  function addCampo() {
    setEditDialog(prev => prev ? {
      ...prev,
      campos: [...prev.campos, { nombre: '', label: '', tipo: 'texto', requerido: false }],
    } : prev)
  }

  function removeCampo(i: number) {
    setEditDialog(prev => prev ? { ...prev, campos: prev.campos.filter((_, idx) => idx !== i) } : prev)
  }

  function updateCampoLabel(i: number, label: string) {
    setEditDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], label, nombre: slugify(label) }
      return { ...prev, campos }
    })
  }

  function updateCampoTipo(i: number, tipo: CampoDefinicion['tipo']) {
    setEditDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], tipo }
      return { ...prev, campos }
    })
  }

  function updateCampoRequerido(i: number, requerido: boolean) {
    setEditDialog(prev => {
      if (!prev) return prev
      const campos = [...prev.campos]
      campos[i] = { ...campos[i], requerido }
      return { ...prev, campos }
    })
  }

  async function saveEdit() {
    if (!editDialog) return
    const res = await fetch(`/api/configuracion/tipos-documento/${editDialog.tipo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editDialog.tipo,
        nombre: editDialog.nombre,
        descripcion: editDialog.descripcion,
        accion: editDialog.accion,
        tienePeriodo: editDialog.tienePeriodo,
        campos: editDialog.campos,
      }),
    })
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    setEditDialog(null)
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
                  <tr key={tipo.id} className={`border-t${tipo.protegido ? ' bg-muted/50' : ''}`}>
                    <td className="px-4 py-2 font-medium">
                      {tipo.nombre}
                      {tipo.campos?.length ? (
                        <span className="ml-2 text-xs text-muted-foreground">· {tipo.campos.length} campo{tipo.campos.length !== 1 ? 's' : ''}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{tipo.descripcion ?? '—'}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{ACCIONES[tipo.accion] ?? tipo.accion}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Editar tipo" onClick={() => openEditDialog(tipo)}>
                          <Pencil size={13} />
                        </Button>
                        {tipo.protegido ? (
                          <span title="Tipo protegido: no se puede eliminar" className="inline-flex items-center px-2 text-muted-foreground/50"><Lock size={13} /></span>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setDeleteId(tipo.id)}>
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </td>
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
                      <Select value={newTipo.accion} onValueChange={v => v && setNewTipo(t => ({ ...t, accion: v }))}>
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

      <Dialog open={!!editDialog} onOpenChange={open => { if (!open) setEditDialog(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar "{editDialog?.tipo.nombre}"</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                  <Input
                    value={editDialog.nombre}
                    onChange={e => setEditDialog(prev => prev ? { ...prev, nombre: e.target.value } : prev)}
                    disabled={editDialog.tipo.protegido}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Acción</p>
                  <Select
                    value={editDialog.accion}
                    onValueChange={v => v && setEditDialog(prev => prev ? { ...prev, accion: v } : prev)}
                    disabled={editDialog.tipo.protegido}
                  >
                    <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      {Object.entries(ACCIONES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                <Input
                  value={editDialog.descripcion}
                  onChange={e => setEditDialog(prev => prev ? { ...prev, descripcion: e.target.value } : prev)}
                  disabled={editDialog.tipo.protegido}
                  placeholder="Descripción (opcional)"
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Solicitar período (Mes/Año)</p>
                  <p className="text-xs text-muted-foreground">Activalo para pedir mes y año al cargar este tipo de documento.</p>
                </div>
                <Switch
                  checked={editDialog.tienePeriodo}
                  onCheckedChange={v => setEditDialog(prev => prev ? { ...prev, tienePeriodo: v } : prev)}
                />
              </div>

              <div>
                <p className="text-xs font-medium mb-2">Campos adicionales</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Campos que se pedirán al subir un documento de este tipo.
                </p>
                {editDialog.campos.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-3 border rounded-md mb-2">
                    Sin campos definidos.
                  </p>
                )}
                <div className="space-y-2">
                  {editDialog.campos.map((campo, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={campo.label}
                        onChange={e => updateCampoLabel(i, e.target.value)}
                        placeholder="Etiqueta del campo"
                        className="h-8 text-sm flex-1"
                      />
                      <Select value={campo.tipo} onValueChange={v => updateCampoTipo(i, v as CampoDefinicion['tipo'])}>
                        <SelectTrigger className="w-28 h-8 text-sm shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent side="bottom" alignItemWithTrigger={false}>
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
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={addCampo}>
                  <Plus size={13} className="mr-1" /> Agregar campo
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteId !== null}
        title="¿Eliminar tipo de documento?"
        description="Los documentos asociados quedarán sin tipo."
        onConfirm={doDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}
