'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { Upload, Paperclip, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Tipo { id: number; nombre: string; descripcion?: string }
interface Solicitud {
  id: number; nombreArchivo: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  createdAt: string; tipo: Tipo
}

export function MisSolicitudes() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [tipoId, setTipoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    fetch('/api/solicitudes').then(r => r.json()).then(setSolicitudes)
  }

  useEffect(() => {
    fetch('/api/solicitudes/tipos').then(r => r.json()).then(setTipos)
    load()
  }, [])

  async function handleSubmit() {
    if (!tipoId || !file) { toast.error('Seleccioná un tipo y un archivo'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/solicitudes/archivo', { method: 'POST', body: fd })
      if (!uploadRes.ok) { toast.error('Error al subir el archivo'); return }
      const { fileName } = await uploadRes.json()

      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoId: Number(tipoId), nombreArchivo: fileName, descripcion }),
      })
      if (!res.ok) { toast.error('Error al enviar la solicitud'); return }
      toast.success('Documento enviado correctamente')
      setTipoId('')
      setDescripcion('')
      setFile(null)
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
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger className="sm:w-52">
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

            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 font-normal"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
              ) : (
                <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Elegir archivo…</span></>
              )}
            </Button>

            <Button
              className="bg-green-700 hover:bg-green-800 shrink-0"
              disabled={!tipoId || !file || uploading}
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
            {solicitudes.map(s => (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3 bg-card">
                <FileText size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.tipo.nombre}</p>
                  <a
                    href={`/api/solicitudes/archivo?file=${s.nombreArchivo}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline truncate block"
                  >
                    {s.nombreArchivo.replace(/^\d+-/, '')}
                  </a>
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
