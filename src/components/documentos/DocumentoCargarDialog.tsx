'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Upload, FileText, X, Search, Users, User } from 'lucide-react'
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

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
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
  const [scope, setScope] = useState<'especificos' | 'todos'>('todos')
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(CURRENT_YEAR))
  const [tipoDocumentoId, setTipoDocumentoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tipos, setTipos] = useState<TipoDoc[]>([])
  const [empleadosCount, setEmpleadosCount] = useState<number | null>(null)
  const [estado, setEstado] = useState<'ENVIADO_A_FIRMA' | 'BORRADOR'>('ENVIADO_A_FIRMA')
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
      setTipos(Array.isArray(tiposData) ? tiposData : [])
    })
  }, [open])

  useEffect(() => {
    if (!open || scope !== 'todos') { setEmpleadosCount(null); return }
    const params = new URLSearchParams({ all: 'true', estado: 'ACTIVO' })
    if (categoriaId) params.set('categoriaId', categoriaId)
    fetch(`/api/empleados?${params}`)
      .then(r => r.json())
      .then(d => setEmpleadosCount(d.total ?? 0))
  }, [open, scope, categoriaId])

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

  function toggleEmpleado(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredEmpleados = empleados.filter(e => {
    const q = search.toLowerCase()
    return (
      e.legajo.toLowerCase().includes(q) ||
      e.apellido.toLowerCase().includes(q) ||
      e.nombre.toLowerCase().includes(q)
    )
  })

  const selectedTipo = tipos.find(t => String(t.id) === tipoDocumentoId)
  const mostrarPeriodo = !selectedTipo || selectedTipo.tienePeriodo !== false

  async function handleSubmit() {
    if (!file) { toast.error('Seleccioná un archivo'); return }
    if (scope === 'especificos' && selectedIds.size === 0) {
      toast.error('Seleccioná al menos un empleado')
      return
    }
    setSaving(true)
    const formData = new FormData()
    formData.append('file', file)
    if (mostrarPeriodo) formData.append('periodo', `${ano}-${mes}`)
    if (tipoDocumentoId) formData.append('tipoDocumentoId', tipoDocumentoId)
    formData.append('estado', estado)
    if (scope === 'todos' && categoriaId) formData.append('categoriaId', categoriaId)
    if (scope === 'especificos') formData.append('empleadoIds', JSON.stringify(Array.from(selectedIds)))

    const res = await fetch('/api/documentos/masivo', { method: 'POST', body: formData })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    toast.success(`Documento distribuido a ${data.uploaded} empleado${data.uploaded !== 1 ? 's' : ''}`)
    onSaved()
    onClose()
  }

  function reset() {
    setFile(null)
    setScope('todos')
    setMes(String(new Date().getMonth() + 1).padStart(2, '0'))
    setAno(String(CURRENT_YEAR))
    setTipoDocumentoId('')
    setCategoriaId('')
    setEstado('ENVIADO_A_FIRMA')
    setSelectedIds(new Set())
    setSearch('')
  }

  const canSubmit = !!file && !saving && (
    scope === 'todos' ? (empleadosCount ?? 0) > 0 : selectedIds.size > 0
  )

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
                <SelectTrigger><SelectValue placeholder="Sin tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {tipos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Estado */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Estado al cargar</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEstado('ENVIADO_A_FIRMA')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  estado === 'ENVIADO_A_FIRMA'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'border-border hover:border-muted-foreground text-muted-foreground'
                )}
              >
                Enviado
              </button>
              <button
                type="button"
                onClick={() => setEstado('BORRADOR')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  estado === 'BORRADOR'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'border-border hover:border-muted-foreground text-muted-foreground'
                )}
              >
                Borrador
              </button>
            </div>
          </div>

          {/* Período */}
          {mostrarPeriodo && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Período</p>
              <div className="flex gap-2">
                <Select value={mes} onValueChange={v => { if (v) setMes(v) }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={ano} onValueChange={v => { if (v) setAno(v) }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Scope selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Destinatarios</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('todos')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  scope === 'todos'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'border-border hover:border-muted-foreground text-muted-foreground'
                )}
              >
                <Users size={15} />
                Todos / categoría
              </button>
              <button
                type="button"
                onClick={() => setScope('especificos')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  scope === 'especificos'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'border-border hover:border-muted-foreground text-muted-foreground'
                )}
              >
                <User size={15} />
                Empleados específicos
              </button>
            </div>
          </div>

          {/* Todos: filtro por categoría */}
          {scope === 'todos' && (
            <>
              {categorias.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Categoría (opcional)</p>
                  <Select value={categoriaId} onValueChange={v => setCategoriaId(!v || v === 'todos' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los empleados</SelectItem>
                      {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            </>
          )}

          {/* Específicos: lista con búsqueda */}
          {scope === 'especificos' && (
            <div className="space-y-2">
              {selectedIds.size > 0 && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  {selectedIds.size} empleado{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </p>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por legajo o nombre…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="border rounded-lg overflow-y-auto max-h-44">
                {filteredEmpleados.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                )}
                {filteredEmpleados.map(e => (
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
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Distribuyendo...' : 'Distribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
