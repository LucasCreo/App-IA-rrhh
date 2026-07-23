'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ClipboardList, CheckCircle2, Circle, Upload, Paperclip, X } from 'lucide-react'

interface Campo {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion' | 'archivo'
  opciones?: string
  requerido: boolean
  rellena?: 'admin' | 'empleado'
}

interface Respuesta {
  id: number
  estado: string
  datos: Record<string, string>
  updatedAt: string
  asignacion: {
    nombre: string
    fechaLimite: string | null
    datosAdmin: Record<string, string>
    plantilla: { nombre: string; campos: Campo[] }
  }
}

function displayNameFromFile(f: string) { return f.replace(/^\d+-/, '') }

export function MisFormularios() {
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [editRespuesta, setEditRespuesta] = useState<Respuesta | null>(null)
  const [viewRespuesta, setViewRespuesta] = useState<Respuesta | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingCampo, setUploadingCampo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingCampo, setPendingCampo] = useState<string | null>(null)

  async function subirArchivo(campo: string, file: File) {
    setUploadingCampo(campo)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/formularios/archivo', { method: 'POST', body: fd })
    setUploadingCampo(null)
    if (!r.ok) { toast.error('Error al subir el archivo'); return }
    const { fileName } = await r.json()
    setForm(prev => ({ ...prev, [campo]: fileName }))
  }

  function load() {
    fetch('/api/empleado/formularios').then(r => r.json()).then(setRespuestas)
  }
  useEffect(() => { load() }, [])

  function openFill(r: Respuesta) {
    setForm({ ...r.datos })
    setEditRespuesta(r)
  }

  function setField(nombre: string, value: string) {
    setForm(prev => ({ ...prev, [nombre]: value }))
  }

  async function handleEnviar() {
    if (!editRespuesta) return
    const campos = editRespuesta.asignacion.plantilla.campos
    for (const campo of campos) {
      if ((campo.rellena ?? 'empleado') === 'empleado' && campo.requerido && !form[campo.nombre]?.trim()) {
        toast.error(`El campo "${campo.label}" es requerido`)
        return
      }
    }
    setSaving(true)
    const res = await fetch(`/api/formularios/respuestas/${editRespuesta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos: form }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al enviar'); return }
    setEditRespuesta(null); load()
    toast.success('Formulario enviado')
  }

  if (respuestas.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tenés formularios asignados</p>
      </div>
    )
  }

  const pendientes = respuestas.filter(r => r.estado === 'PENDIENTE')
  const enviadas = respuestas.filter(r => r.estado === 'ENVIADO')

  return (
    <div className="space-y-4">
      {pendientes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pendientes</p>
          <div className="space-y-2">
            {pendientes.map(r => (
              <div key={r.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.asignacion.nombre}</p>
                  <p className="text-xs text-muted-foreground">{r.asignacion.plantilla.nombre}</p>
                  {r.asignacion.fechaLimite && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                      Vence: {new Date(r.asignacion.fechaLimite!).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Circle size={12} /> Pendiente
                  </span>
                  <Button size="sm" className="bg-green-700 hover:bg-green-800 h-8 text-xs" onClick={() => openFill(r)}>
                    Completar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enviadas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Enviados</p>
          <div className="space-y-2">
            {enviadas.map(r => (
              <div key={r.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.asignacion.nombre}</p>
                  <p className="text-xs text-muted-foreground">{r.asignacion.plantilla.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enviado el {new Date(r.updatedAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 size={12} /> Enviado
                  </span>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setViewRespuesta(r)}>
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fill form dialog */}
      <Dialog open={editRespuesta !== null} onOpenChange={v => !v && setEditRespuesta(null)}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editRespuesta?.asignacion.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {editRespuesta?.asignacion.plantilla.campos.length === 0 && (
              <p className="text-sm text-muted-foreground">Este formulario no tiene campos.</p>
            )}
            {editRespuesta?.asignacion.plantilla.campos.map(campo => {
              const esAdmin = campo.rellena === 'admin'
              const valorAdmin = editRespuesta.asignacion.datosAdmin?.[campo.nombre]
              if (esAdmin && !valorAdmin) return null
              return (
                <div key={campo.nombre}>
                  <p className="text-xs font-medium mb-1 flex items-center gap-1.5">
                    {campo.label}
                    {!esAdmin && campo.requerido && <span className="text-red-500">*</span>}
                    {esAdmin && <span className="text-xs text-blue-500 font-normal">(completado por RRHH)</span>}
                  </p>
                  {esAdmin ? (
                    <p className="text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-blue-900 dark:text-blue-100">
                      {valorAdmin}
                    </p>
                  ) : campo.tipo === 'seleccion' ? (
                    <Select value={form[campo.nombre] ?? ''} onValueChange={v => setField(campo.nombre, v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Seleccioná una opción" /></SelectTrigger>
                      <SelectContent>
                        {(campo.opciones ?? '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : campo.tipo === 'archivo' ? (
                    <div className="flex items-center gap-2">
                      {form[campo.nombre] ? (
                        <>
                          <a
                            href={`/api/formularios/archivo?file=${form[campo.nombre]}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-sm text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 truncate"
                          >
                            <Paperclip size={13} /> {displayNameFromFile(form[campo.nombre])}
                          </a>
                          <button
                            type="button"
                            onClick={() => setField(campo.nombre, '')}
                            className="text-muted-foreground hover:text-destructive"
                            title="Quitar"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-9"
                          disabled={uploadingCampo === campo.nombre}
                          onClick={() => { setPendingCampo(campo.nombre); fileInputRef.current?.click() }}
                        >
                          <Upload size={13} className="mr-1.5" />
                          {uploadingCampo === campo.nombre ? 'Subiendo…' : 'Subir archivo'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Input
                      type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                      value={form[campo.nombre] ?? ''}
                      onChange={e => setField(campo.nombre, e.target.value)}
                      placeholder={campo.tipo === 'texto' ? `${campo.label}...` : undefined}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditRespuesta(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleEnviar} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file && pendingCampo) subirArchivo(pendingCampo, file)
              setPendingCampo(null)
              e.target.value = ''
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View submitted dialog */}
      <Dialog open={viewRespuesta !== null} onOpenChange={v => !v && setViewRespuesta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewRespuesta?.asignacion.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {viewRespuesta?.asignacion.plantilla.campos.map(campo => {
              const esAdmin = campo.rellena === 'admin'
              const valor = esAdmin
                ? viewRespuesta.asignacion.datosAdmin?.[campo.nombre]
                : viewRespuesta.datos?.[campo.nombre]
              if (esAdmin && !valor) return null
              return (
                <div key={campo.nombre}>
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    {campo.label}
                    {esAdmin && <span className="text-xs text-blue-500">(RRHH)</span>}
                  </p>
                  {campo.tipo === 'archivo' && valor ? (
                    <a
                      href={`/api/formularios/archivo?file=${valor}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Paperclip size={13} /> {displayNameFromFile(valor)}
                    </a>
                  ) : (
                    <p className={`text-sm rounded-md px-3 py-2 ${esAdmin ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100' : 'bg-muted/40'}`}>
                      {valor || <span className="text-muted-foreground italic">Sin respuesta</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
