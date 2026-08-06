'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Paperclip, X } from 'lucide-react'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'

export interface FormularioCampo {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion' | 'archivo'
  opciones?: string
  requerido: boolean
  rellena?: 'admin' | 'empleado'
}

export interface FormularioRespuesta {
  id: number
  estado: string
  datos: Record<string, string>
  updatedAt: string
  asignacion: {
    nombre: string
    fechaLimite: string | null
    datosAdmin: Record<string, string>
    plantilla: { nombre: string; campos: FormularioCampo[] }
  }
}

function displayNameFromFile(f: string) { return f.replace(/^\d+-/, '') }

interface Props {
  respuesta: FormularioRespuesta | null
  mode: 'fill' | 'view'
  onClose: () => void
  onSaved?: () => void
}

export function FormularioDialog({ respuesta, mode, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingCampo, setUploadingCampo] = useState<string | null>(null)
  const [pendingCampo, setPendingCampo] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (respuesta && mode === 'fill') setForm({ ...respuesta.datos })
  }, [respuesta, mode])

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

  function setField(nombre: string, value: string) {
    setForm(prev => ({ ...prev, [nombre]: value }))
  }

  async function handleEnviar() {
    if (!respuesta) return
    const campos = respuesta.asignacion.plantilla.campos
    for (const campo of campos) {
      if ((campo.rellena ?? 'empleado') === 'empleado' && campo.requerido && !form[campo.nombre]?.trim()) {
        toast.error(`El campo "${campo.label}" es requerido`)
        return
      }
    }
    setSaving(true)
    const res = await fetch(`/api/formularios/respuestas/${respuesta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos: form }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al enviar'); return }
    toast.success('Formulario enviado')
    onSaved?.()
    onClose()
  }

  if (mode === 'view') {
    return (
      <Dialog open={respuesta !== null} onOpenChange={v => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{respuesta?.asignacion.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {respuesta?.asignacion.plantilla.campos.map(campo => {
              const esAdmin = campo.rellena === 'admin'
              const valor = esAdmin
                ? respuesta.asignacion.datosAdmin?.[campo.nombre]
                : respuesta.datos?.[campo.nombre]
              if (esAdmin && !valor) return null
              return (
                <div key={campo.nombre}>
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    {campo.label}
                    {esAdmin && <span className="text-xs text-blue-500">(RRHH)</span>}
                  </p>
                  {campo.tipo === 'archivo' && valor ? (
                    <button
                      onClick={() => setPreview({ url: `/api/formularios/archivo?file=${valor}`, filename: valor })}
                      className="text-sm text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Paperclip size={13} /> {displayNameFromFile(valor)}
                    </button>
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
        <ArchivoPreviewDialog
          open={preview !== null}
          onClose={() => setPreview(null)}
          url={preview?.url ?? null}
          filename={preview?.filename ?? null}
        />
      </Dialog>
    )
  }

  return (
    <Dialog open={respuesta !== null} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{respuesta?.asignacion.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {respuesta?.asignacion.plantilla.campos.length === 0 && (
            <p className="text-sm text-muted-foreground">Este formulario no tiene campos.</p>
          )}
          {respuesta?.asignacion.plantilla.campos.map(campo => {
            const esAdmin = campo.rellena === 'admin'
            const valorAdmin = respuesta.asignacion.datosAdmin?.[campo.nombre]
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
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccioná una opción" /></SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      {(campo.opciones ?? '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : campo.tipo === 'archivo' ? (
                  <div className="flex items-center gap-2">
                    {form[campo.nombre] ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreview({ url: `/api/formularios/archivo?file=${form[campo.nombre]}`, filename: form[campo.nombre] })}
                          className="flex-1 text-sm text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 truncate text-left"
                        >
                          <Paperclip size={13} /> {displayNameFromFile(form[campo.nombre])}
                        </button>
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview?.url ?? null}
        filename={preview?.filename ?? null}
      />
    </Dialog>
  )
}
