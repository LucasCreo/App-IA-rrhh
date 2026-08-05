'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, FileText } from 'lucide-react'

interface Props { open: boolean; onClose: () => void; onSaved: () => void }

const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - 2 + i))

export function CrearLoteDialog({ open, onClose, onSaved }: Props) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setNombre('')
    setDescripcion('')
    setFiles([])
  }, [open])

  function addFiles(newFiles: File[]) {
    setFiles(prev => [...prev, ...newFiles])
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, j) => j !== i))
  }

  async function handleSubmit() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre para el lote'); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('nombre', nombre.trim())
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim())
      fd.append('periodo', `${ano}-${mes}`)
      files.forEach((f, i) => { fd.append(`file_${i}`, f) })

      const r = await fetch('/api/lotes', { method: 'POST', body: fd })
      if (!r.ok) {
        await handleApiError(r, href => router.push(href))
        return
      }
      const data = await r.json()

      if (data.errors?.length > 0) {
        toast.warning(`Lote creado con ${data.uploaded} archivo(s). ${data.errors.length} rechazado(s): ${data.errors[0]}`, { duration: 8000 })
      } else if (data.uploaded > 0) {
        const auto = data.asignados ?? 0
        const pend = data.uploaded - auto
        const msg = auto > 0
          ? `Lote creado — ${auto} auto-asignado(s)${pend > 0 ? `, ${pend} pendiente(s)` : ''}`
          : `Lote creado — ${data.uploaded} archivo(s). Asignalos desde el detalle.`
        toast.success(msg)
      } else {
        toast.success('Lote creado')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red al crear el lote')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !!nombre.trim() && !loading

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Nuevo Lote de Recibos</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
          <div>
            <Label className="mb-1.5">Nombre del lote</Label>
            <Input
              className="mt-1"
              placeholder="Ej: Recibos Junio 2026"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              placeholder="Notas internas sobre este lote…"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5">Período</Label>
            <div className="flex gap-2 mt-1">
              <Select value={mes} onValueChange={v => v && setMes(v)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ano} onValueChange={v => v && setAno(v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Archivos PDF <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <div className="mt-1 border-2 border-dashed border-green-300 dark:border-green-800 rounded-lg p-6 text-center">
              <Upload size={24} className="mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p className="text-sm text-muted-foreground mb-3">Elegí archivos sueltos o una carpeta entera</p>
              <div className="flex gap-2 justify-center">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Elegir archivos
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => folderRef.current?.click()}>
                  Elegir carpeta
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Los recibos entran como pendientes. Asigná cada uno a su empleado desde el detalle del lote.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={e => {
                  const list = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
                  addFiles(list)
                  e.target.value = ''
                }}
              />
              <input
                ref={folderRef}
                type="file"
                accept="application/pdf"
                multiple
                // @ts-expect-error webkitdirectory no está en los tipos estándar
                webkitdirectory=""
                className="hidden"
                onChange={e => {
                  const list = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
                  addFiles(list)
                  e.target.value = ''
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Solo se toman los PDFs.
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{files.length} archivo(s) listo(s) para subir</p>
              <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <FileText size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!nombre.trim() && !loading && (
            <p className="text-xs text-muted-foreground sm:mr-auto text-left">
              Ingresá un nombre para continuar.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? 'Creando...' : files.length > 0 ? `Crear Lote (${files.length} archivo${files.length !== 1 ? 's' : ''})` : 'Crear Lote'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
