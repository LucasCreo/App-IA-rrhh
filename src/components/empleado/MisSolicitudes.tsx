'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Upload, Paperclip, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface CampoSolicitud {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha'
  requerido: boolean
}

interface Tipo {
  id: number
  nombre: string
  descripcion?: string
  requiereAprobacion: boolean
  campos: CampoSolicitud[]
}

interface Solicitud {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string; tipo: Tipo
}

export function MisSolicitudes() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [tipoId, setTipoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [campoValues, setCampoValues] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    fetch('/api/solicitudes').then(r => r.json()).then(setSolicitudes)
  }

  useEffect(() => {
    fetch('/api/solicitudes/tipos').then(r => r.json()).then(setTipos)
    load()
  }, [])

  const selectedTipo = tipos.find(t => String(t.id) === tipoId)

  useEffect(() => {
    if (!selectedTipo) { setCampoValues({}); return }
    const defaults: Record<string, string> = {}
    for (const c of selectedTipo.campos) defaults[c.nombre] = ''
    setCampoValues(defaults)
  }, [tipoId]) // eslint-disable-line react-hooks/exhaustive-deps

  function setCampo(nombre: string, value: string) {
    setCampoValues(prev => ({ ...prev, [nombre]: value }))
  }

  const camposValidos = !selectedTipo || selectedTipo.campos.every(c =>
    !c.requerido || campoValues[c.nombre]?.trim()
  )

  async function handleSubmit() {
    if (!tipoId) { toast.error('Seleccioná un tipo'); return }
    if (!camposValidos) { toast.error('Completá los campos requeridos'); return }

    setUploading(true)
    try {
      let fileName: string | null = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/solicitudes/archivo', { method: 'POST', body: fd })
        if (!uploadRes.ok) { toast.error('Error al subir el archivo'); return }
        const data = await uploadRes.json()
        fileName = data.fileName
      }

      const metadata: Record<string, string> = {}
      if (selectedTipo) {
        for (const c of selectedTipo.campos) {
          const v = campoValues[c.nombre]?.trim()
          if (v) metadata[c.nombre] = v
        }
      }

      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId: Number(tipoId),
          nombreArchivo: fileName,
          descripcion,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
      if (!res.ok) { toast.error('Error al enviar la solicitud'); return }
      toast.success('Documento enviado correctamente')
      setTipoId('')
      setDescripcion('')
      setFile(null)
      setCampoValues({})
      if (fileRef.current) fileRef.current.value = ''
      load()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {tipos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tipos de documentos disponibles por el momento.</p>
      ) : (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Enviar documento</p>

          <Select value={tipoId} onValueChange={v => v && setTipoId(v)}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Tipo de documento" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTipo?.descripcion && (
            <p className="text-xs text-muted-foreground">{selectedTipo.descripcion}</p>
          )}

          {/* Dynamic campos */}
          {selectedTipo && selectedTipo.campos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedTipo.campos.map(campo => (
                <div key={campo.nombre}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {campo.label}{campo.requerido && <span className="text-destructive ml-0.5">*</span>}
                  </p>
                  <Input
                    type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                    value={campoValues[campo.nombre] ?? ''}
                    onChange={e => setCampo(campo.nombre, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 font-normal"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
              ) : (
                <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Adjuntar archivo (opcional)…</span></>
              )}
            </Button>

            <Button
              className="bg-green-700 hover:bg-green-800 shrink-0"
              disabled={!tipoId || !camposValidos || uploading}
              onClick={handleSubmit}
            >
              {uploading ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>

          <Textarea
            placeholder="Descripción (opcional) — podés agregar una aclaración para el área de RRHH"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      )}

      {solicitudes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Historial</p>
          <div className="divide-y rounded-lg border overflow-hidden">
            {solicitudes.map(s => {
              const meta = (() => { try { return JSON.parse(s.metadata ?? '{}') as Record<string, string> } catch { return {} } })()
              const metaEntries = Object.entries(meta).filter(([, v]) => v)
              return (
                <div key={s.id} className="flex items-start gap-3 px-4 py-3 bg-card">
                  <FileText size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.tipo.nombre}</p>
                    {s.nombreArchivo && (
                      <a
                        href={`/api/solicitudes/archivo?file=${s.nombreArchivo}`}
                        target="_blank"
                        className="text-xs text-blue-600 hover:underline truncate block"
                      >
                        {s.nombreArchivo.replace(/^\d+-/, '')}
                      </a>
                    )}
                    {metaEntries.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {metaEntries.map(([k, v]) => {
                          const campo = s.tipo.campos?.find(c => c.nombre === k)
                          return (
                            <span key={k} className="text-xs text-muted-foreground">
                              {campo?.label ?? k}: <span className="text-foreground">{v}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {s.descripcion && (
                      <p className="text-xs text-muted-foreground mt-1">{s.descripcion}</p>
                    )}
                    {s.comentario && s.comentarioVisible && (
                      <p className="text-xs text-muted-foreground italic mt-1 border-l-2 border-border pl-2">
                        {s.comentario}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge estado={s.estado} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
