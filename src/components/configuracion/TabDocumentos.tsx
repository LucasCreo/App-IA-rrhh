'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Plus, Check, X, Lock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { handleApiError } from '@/lib/apiErrors'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { FirmaJsonEditor, PlaceholderPalette } from '@/components/configuracion/FirmaJsonEditor'
import { cn } from '@/lib/utils'

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
  metodoFirma?: string
  firmaProveedorNombre?: string | null
  firmaApiKey?: string | null
  firmaApiSecretSet?: boolean
  firmaEndpoint?: string | null
  firmaBody?: string | null
  firmaHeaders?: string | null
  campos?: CampoDefinicion[] | null
  tienePeriodo?: boolean
  protegido?: boolean
}


function esJsonValido(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  try { JSON.parse(t); return true } catch { return false }
}

const ACCIONES: Record<string, string> = {
  FIRMA: 'Firma digital',
  LECTURA: 'Lectura',
  NINGUNA: 'Sin acción',
}

const METODOS_FIRMA: Record<string, string> = {
  CONTRASENA: 'Con contraseña',
  PROVEEDOR: 'Con proveedor externo',
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
  metodoFirma: string
  firmaProveedorNombre: string
  firmaApiKey: string
  firmaApiSecret: string        // input local; vacío = no cambiar
  firmaApiSecretSet: boolean
  firmaApiSecretClear: boolean  // true = borrar el secret guardado al guardar
  firmaEndpoint: string
  firmaBody: string
  firmaHeaders: string
  tienePeriodo: boolean
  campos: CampoDefinicion[]
}

export function TabDocumentos() {
  const router = useRouter()
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [adding, setAdding] = useState(false)
  const [newTipo, setNewTipo] = useState({ nombre: '', descripcion: '', accion: 'FIRMA' })
  const [editDialog, setEditDialog] = useState<EditState | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; url: string; body: string } | null>(null)

  async function probarFirma() {
    if (!editDialog) return
    if (!editDialog.firmaEndpoint.trim()) { toast.error('Falta la URL del endpoint'); return }
    if (!esJsonValido(editDialog.firmaBody)) { toast.error('Body no es JSON válido'); return }
    if (!esJsonValido(editDialog.firmaHeaders)) { toast.error('Headers no es JSON válido'); return }
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/configuracion/firma/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmaEndpoint: editDialog.firmaEndpoint,
          firmaBody: editDialog.firmaBody,
          firmaHeaders: editDialog.firmaHeaders,
          firmaApiKey: editDialog.firmaApiKey,
          firmaApiSecret: editDialog.firmaApiSecret,
        }),
      })
      const d = await r.json().catch(() => ({}))
      setTestResult(d)
    } finally { setTesting(false) }
  }
  const [deleteId, setDeleteId] = useState<number | null>(null)

  async function load() {
    const rt = await fetch('/api/configuracion/tipos-documento')
    setTipos(await rt.json())
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
      metodoFirma: tipo.metodoFirma ?? 'CONTRASENA',
      firmaProveedorNombre: tipo.firmaProveedorNombre ?? '',
      firmaApiKey: tipo.firmaApiKey ?? '',
      firmaApiSecret: '',
      firmaApiSecretSet: !!tipo.firmaApiSecretSet,
      firmaApiSecretClear: false,
      firmaEndpoint: tipo.firmaEndpoint ?? '',
      firmaBody: tipo.firmaBody ?? '',
      firmaHeaders: tipo.firmaHeaders ?? '',
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
    if (editDialog.metodoFirma === 'PROVEEDOR' && editDialog.accion === 'FIRMA') {
      if (!editDialog.firmaEndpoint.trim()) { toast.error('Falta la URL del endpoint'); return }
      if (!esJsonValido(editDialog.firmaBody)) { toast.error('Body no es JSON válido'); return }
      if (!esJsonValido(editDialog.firmaHeaders)) { toast.error('Headers no es JSON válido'); return }
    }
    const payload: Record<string, unknown> = {
      ...editDialog.tipo,
      nombre: editDialog.nombre,
      descripcion: editDialog.descripcion,
      accion: editDialog.accion,
      metodoFirma: editDialog.metodoFirma,
      firmaProveedorNombre: editDialog.firmaProveedorNombre,
      firmaApiKey: editDialog.firmaApiKey,
      firmaEndpoint: editDialog.firmaEndpoint,
      firmaBody: editDialog.firmaBody,
      firmaHeaders: editDialog.firmaHeaders,
      tienePeriodo: editDialog.tienePeriodo,
      campos: editDialog.campos,
    }
    if (editDialog.firmaApiSecretClear) payload.firmaApiSecretClear = true
    else if (editDialog.firmaApiSecret) payload.firmaApiSecret = editDialog.firmaApiSecret
    const res = await fetch(`/api/configuracion/tipos-documento/${editDialog.tipo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {ACCIONES[tipo.accion] ?? tipo.accion}
                      {tipo.accion === 'FIRMA' && (
                        <span
                          className={
                            'ml-2 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ' +
                            (tipo.metodoFirma === 'PROVEEDOR'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground')
                          }
                          title={METODOS_FIRMA[tipo.metodoFirma ?? 'CONTRASENA'] ?? tipo.metodoFirma}
                        >
                          {tipo.metodoFirma === 'PROVEEDOR' ? 'Proveedor' : 'Contraseña'}
                        </span>
                      )}
                    </td>
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
              {editDialog.accion === 'FIRMA' && (
                <div className="space-y-4 rounded-md border p-3 bg-muted/20">
                  <div>
                    <Label className="mb-1.5">Método de firma</Label>
                    <Select
                      value={editDialog.metodoFirma}
                      onValueChange={v => v && setEditDialog(prev => prev ? { ...prev, metodoFirma: v } : prev)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full sm:w-64"><SelectValue /></SelectTrigger>
                      <SelectContent side="bottom" alignItemWithTrigger={false}>
                        {Object.entries(METODOS_FIRMA).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {editDialog.metodoFirma === 'PROVEEDOR' && (
                    <div className="space-y-4 rounded-md border p-3 bg-muted/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Label className="mb-1.5">Nombre del proveedor (opcional)</Label>
                          <Input
                            value={editDialog.firmaProveedorNombre}
                            onChange={e => setEditDialog(prev => prev ? { ...prev, firmaProveedorNombre: e.target.value } : prev)}
                            placeholder="Ej: Aditus prod"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="mb-1.5">URL (endpoint) *</Label>
                          <Input
                            value={editDialog.firmaEndpoint}
                            onChange={e => setEditDialog(prev => prev ? { ...prev, firmaEndpoint: e.target.value } : prev)}
                            placeholder="https://api.proveedor.com/sign"
                            className="h-8 text-sm font-mono"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">URL completa a la que se hace el POST.</p>
                        </div>
                        <div>
                          <Label className="mb-1.5">API Key (opcional)</Label>
                          <Input
                            value={editDialog.firmaApiKey}
                            onChange={e => setEditDialog(prev => prev ? { ...prev, firmaApiKey: e.target.value } : prev)}
                            placeholder="ID público o key"
                            className="h-8 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <Label className="mb-1.5 flex items-center justify-between gap-2">
                            <span>
                              API Secret (opcional)
                              {editDialog.firmaApiSecretSet && !editDialog.firmaApiSecretClear && (
                                <span className="text-green-700 dark:text-green-400 text-xs font-normal ml-1">(configurado — dejá vacío para no cambiarlo)</span>
                              )}
                              {editDialog.firmaApiSecretClear && (
                                <span className="text-red-600 dark:text-red-400 text-xs font-normal ml-1">se eliminará al guardar</span>
                              )}
                            </span>
                            {editDialog.firmaApiSecretSet && !editDialog.firmaApiSecretClear && (
                              <button
                                type="button"
                                onClick={() => setEditDialog(prev => prev ? { ...prev, firmaApiSecret: '', firmaApiSecretClear: true } : prev)}
                                className="text-[11px] text-red-600 hover:underline"
                              >
                                Borrar
                              </button>
                            )}
                            {editDialog.firmaApiSecretClear && (
                              <button
                                type="button"
                                onClick={() => setEditDialog(prev => prev ? { ...prev, firmaApiSecretClear: false } : prev)}
                                className="text-[11px] text-muted-foreground hover:underline"
                              >
                                Deshacer
                              </button>
                            )}
                          </Label>
                          <Input
                            type="text"
                            value={editDialog.firmaApiSecretClear ? '' : editDialog.firmaApiSecret}
                            onChange={e => setEditDialog(prev => prev ? { ...prev, firmaApiSecret: e.target.value, firmaApiSecretClear: false } : prev)}
                            placeholder={editDialog.firmaApiSecretClear ? '(vacío)' : editDialog.firmaApiSecretSet ? '••••••••' : 'secret'}
                            autoComplete="off"
                            data-1p-ignore
                            data-lpignore="true"
                            data-form-type="other"
                            disabled={editDialog.firmaApiSecretClear}
                            className="h-8 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-1.5">Placeholders (arrastrá al campo)</Label>
                        <PlaceholderPalette />
                      </div>

                      <div>
                        <Label className="mb-1.5 flex items-center gap-2">
                          Headers (JSON, opcional)
                          {editDialog.firmaHeaders && !esJsonValido(editDialog.firmaHeaders) && (
                            <span className="text-[11px] font-normal text-red-600 dark:text-red-400">JSON inválido</span>
                          )}
                        </Label>
                        <FirmaJsonEditor
                          value={editDialog.firmaHeaders}
                          onChange={v => setEditDialog(prev => prev ? { ...prev, firmaHeaders: v } : prev)}
                          placeholder='{"Authorization": "Bearer {apiKey}", "Content-Type": "application/json"}'
                          invalid={!!editDialog.firmaHeaders && !esJsonValido(editDialog.firmaHeaders)}
                          minRows={4}
                        />
                      </div>

                      <div>
                        <Label className="mb-1.5 flex items-center gap-2">
                          Body (JSON)
                          {editDialog.firmaBody && !esJsonValido(editDialog.firmaBody) && (
                            <span className="text-[11px] font-normal text-red-600 dark:text-red-400">JSON inválido</span>
                          )}
                        </Label>
                        <FirmaJsonEditor
                          value={editDialog.firmaBody}
                          onChange={v => setEditDialog(prev => prev ? { ...prev, firmaBody: v } : prev)}
                          placeholder='{"documentId": "{documentId}", "signerEmail": "{empleado.email}"}'
                          invalid={!!editDialog.firmaBody && !esJsonValido(editDialog.firmaBody)}
                          minRows={6}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={probarFirma} disabled={testing}>
                          {testing ? 'Probando…' : 'Probar conexión'}
                        </Button>
                        <p className="text-[11px] text-muted-foreground">Hace el POST con datos ficticios y muestra la respuesta cruda.</p>
                      </div>

                      {testResult && (
                        <div className={cn('rounded-md border p-2 text-xs', testResult.ok ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : 'border-red-500/50 bg-red-50 dark:bg-red-950/20')}>
                          <p className="font-medium mb-1">
                            {testResult.ok ? 'OK' : 'Error'} · HTTP {testResult.status} · <span className="font-mono text-[10px] break-all">{testResult.url}</span>
                          </p>
                          <pre className="font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-auto">{testResult.body || '(respuesta vacía)'}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
