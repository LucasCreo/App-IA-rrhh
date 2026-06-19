'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface Categoria { id: number; nombre: string }
interface TipoDoc { id: number; nombre: string; tienePeriodo?: boolean }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function DocumentoMasivoDialog({ open, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(CURRENT_YEAR))
  const [tipoDocumentoId, setTipoDocumentoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tipos, setTipos] = useState<TipoDoc[]>([])
  const [empleadosCount, setEmpleadosCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/categorias').then(r => r.json()),
      fetch('/api/configuracion/tipos-documento').then(r => r.json()),
    ]).then(([cats, tipos]) => {
      setCategorias(Array.isArray(cats) ? cats : [])
      setTipos(Array.isArray(tipos) ? tipos : [])
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams({ all: 'true', estado: 'ACTIVO' })
    if (categoriaId) params.set('categoriaId', categoriaId)
    fetch(`/api/empleados?${params}`)
      .then(r => r.json())
      .then(d => setEmpleadosCount(d.total ?? 0))
  }, [open, categoriaId])

  function handleFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { toast.error('El archivo supera los 10 MB'); return }
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleSubmit() {
    if (!file) { toast.error('Seleccioná un archivo'); return }
    setSaving(true)
    const formData = new FormData()
    formData.append('file', file)
    const selectedTipo = tipos.find(t => String(t.id) === tipoDocumentoId)
    if (!selectedTipo || selectedTipo.tienePeriodo !== false) {
      formData.append('periodo', `${ano}-${mes}`)
    }
    if (tipoDocumentoId) formData.append('tipoDocumentoId', tipoDocumentoId)
    if (categoriaId) formData.append('categoriaId', categoriaId)

    const res = await fetch('/api/documentos/masivo', { method: 'POST', body: formData })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    toast.success(`Documento distribuido a ${data.uploaded} empleados`)
    onSaved()
    onClose()
  }

  function reset() {
    setFile(null)
    setMes(String(new Date().getMonth() + 1).padStart(2, '0'))
    setAno(String(CURRENT_YEAR))
    setTipoDocumentoId('')
    setCategoriaId('')
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Distribución masiva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Zona de drop */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
              dragging ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border hover:border-muted-foreground'
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={16} className="text-green-600 shrink-0" />
                <span className="text-sm font-medium truncate max-w-[220px]">{file.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Upload size={20} className="mx-auto mb-1" />
                <p className="text-sm">Arrastrá o hacé clic para subir un PDF</p>
              </div>
            )}
          </div>

          {/* Período */}
          {(() => {
            const selected = tipos.find(t => String(t.id) === tipoDocumentoId)
            const mostrar = !selected || selected.tienePeriodo !== false
            return mostrar ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Período</p>
                <div className="flex gap-2">
                  <Select value={mes} onValueChange={setMes}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={ano} onValueChange={setAno}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null
          })()}

          {/* Tipo de documento */}
          {tipos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tipo de documento (opcional)</p>
              <Select value={tipoDocumentoId} onValueChange={v => setTipoDocumentoId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {tipos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Categoría */}
          {categorias.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Categoría (opcional)</p>
              <Select value={categoriaId} onValueChange={v => setCategoriaId(v === 'todos' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los empleados</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          {empleadosCount !== null && (
            <p className={cn(
              'text-sm rounded-lg px-3 py-2',
              empleadosCount === 0
                ? 'bg-red-50 dark:bg-red-950/20 text-red-600'
                : 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
            )}>
              {empleadosCount === 0
                ? 'No hay empleados activos en esa categoría'
                : `Se distribuirá a ${empleadosCount} empleado${empleadosCount !== 1 ? 's' : ''} activo${empleadosCount !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleSubmit}
            disabled={saving || !file || empleadosCount === 0}
          >
            {saving ? 'Distribuyendo...' : 'Distribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
