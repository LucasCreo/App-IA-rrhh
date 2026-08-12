'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Upload, FileText, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isPdfFile, MAX_PDF_SIZE } from '@/lib/pdf'

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

interface Empleado { id: number; nombre: string; apellido: string; legajo: string; categoria?: { id: number; nombre: string } | null }
interface Categoria { id: number; nombre: string }
interface TipoDoc { id: number; nombre: string; tienePeriodo?: boolean }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function DocumentoCargarDialog({ open, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(CURRENT_YEAR))
  const [tipoDocumentoId, setTipoDocumentoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tipos, setTipos] = useState<TipoDoc[]>([])
  const [estado, setEstado] = useState<'ENVIADO_A_FIRMA' | 'BORRADOR'>('BORRADOR')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/empleados?all=true&estado=ACTIVO').then(r => r.json()),
      fetch('/api/categorias').then(r => r.json()),
      fetch('/api/configuracion/tipos-documento').then(r => r.json()),
    ]).then(([empData, cats, tiposData]) => {
      setEmpleados(empData.employees ?? [])
      setCategorias(Array.isArray(cats) ? cats : [])
      setTipos(Array.isArray(tiposData) ? tiposData.filter((t: TipoDoc) => t.nombre !== 'Recibo de Sueldo') : [])
    })
  }, [open])

  async function handleFile(f: File) {
    if (f.size > MAX_PDF_SIZE) { toast.error('El archivo supera los 10 MB'); return }
    if (!(await isPdfFile(f))) { toast.error('El archivo no es un PDF válido'); return }
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function toggleEmpleado(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredEmpleados = empleados.filter(e => {
    if (categoriaId && String(e.categoria?.id ?? '') !== categoriaId) return false
    const q = search.toLowerCase()
    if (!q) return true
    return (
      e.legajo.toLowerCase().includes(q) ||
      e.apellido.toLowerCase().includes(q) ||
      e.nombre.toLowerCase().includes(q)
    )
  })

  const filteredIds = filteredEmpleados.map(e => e.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
  const someFilteredSelected = filteredIds.some(id => selectedIds.has(id)) && !allFilteredSelected

  function toggleAllFiltered() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id)
      } else {
        for (const id of filteredIds) next.add(id)
      }
      return next
    })
  }

  const selectedTipo = tipos.find(t => String(t.id) === tipoDocumentoId)
  const mostrarPeriodo = !!selectedTipo && selectedTipo.tienePeriodo !== false

  async function handleSubmit() {
    if (!file) { toast.error('Seleccioná un archivo'); return }
    if (selectedIds.size === 0) { toast.error('Seleccioná al menos un empleado'); return }
    setSaving(true)
    const formData = new FormData()
    formData.append('file', file)
    if (mostrarPeriodo) formData.append('periodo', `${ano}-${mes}`)
    if (tipoDocumentoId) formData.append('tipoDocumentoId', tipoDocumentoId)
    formData.append('estado', estado)
    formData.append('empleadoIds', JSON.stringify(Array.from(selectedIds)))

    const res = await fetch('/api/documentos/masivo', { method: 'POST', body: formData })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    toast.success(`Documento subido a ${data.uploaded} empleado${data.uploaded !== 1 ? 's' : ''}`)
    onSaved()
    onClose()
  }

  function reset() {
    setFile(null)
    setMes(String(new Date().getMonth() + 1).padStart(2, '0'))
    setAno(String(CURRENT_YEAR))
    setTipoDocumentoId('')
    setCategoriaId('')
    setEstado('BORRADOR')
    setSelectedIds(new Set())
    setSearch('')
  }

  const canSubmit = !!file && !saving && selectedIds.size > 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Cargar documento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1 px-0.5">
          {/* Zona de drop */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer',
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
                <span className="text-sm font-medium truncate max-w-[240px]">{file.name}</span>
                <button onClick={e => { e.stopPropagation(); setFile(null) }} className="text-muted-foreground hover:text-foreground">
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

          {/* Tipo de documento */}
          {tipos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tipo de documento (opcional)</p>
              <Select value={tipoDocumentoId} onValueChange={v => setTipoDocumentoId(!v || v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sin tipo" /></SelectTrigger>
                <SelectContent side="bottom" alignItemWithTrigger={false}>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {tipos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Período */}
          {mostrarPeriodo && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Período</p>
              <div className="flex gap-2">
                <Select value={mes} onValueChange={v => { if (v) setMes(v) }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" alignItemWithTrigger={false}>
                    {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={ano} onValueChange={v => { if (v) setAno(v) }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" alignItemWithTrigger={false}>
                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Destinatarios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Destinatarios</p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por legajo o nombre…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {categorias.length > 0 && (
                <Select value={categoriaId || 'todos'} onValueChange={v => setCategoriaId(!v || v === 'todos' ? '' : v)}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas categorías</SelectItem>
                    {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="border rounded-lg overflow-hidden">
              <label className="flex items-center gap-2.5 px-3 py-2 border-b bg-muted/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={el => { if (el) el.indeterminate = someFilteredSelected }}
                  onChange={toggleAllFiltered}
                  className="accent-green-700"
                />
                <span className="text-xs font-medium">
                  {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  {filteredEmpleados.length !== empleados.length && ` (${filteredEmpleados.length})`}
                </span>
              </label>
              <div className="overflow-y-auto max-h-52">
                {filteredEmpleados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                ) : filteredEmpleados.map(e => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleEmpleado(e.id)}
                      className="accent-green-700"
                    />
                    <span className="text-xs text-muted-foreground w-14 shrink-0">{e.legajo}</span>
                    <span className="text-sm">{e.apellido}, {e.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Subiendo...' : 'Subir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
