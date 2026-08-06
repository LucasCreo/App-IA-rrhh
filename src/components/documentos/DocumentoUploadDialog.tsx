'use client'

import { useEffect, useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { parseApiError, showApiError } from '@/lib/apiErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmpleadoPicker } from './EmpleadoPicker'
import { Upload, X } from 'lucide-react'

interface CampoDefinicion {
  nombre: string
  label: string
  tipo: 'mes_anio' | 'texto' | 'numero' | 'fecha'
  requerido: boolean
}

interface Empleado { id: number; nombre: string; apellido: string; legajo: string; categoria?: { id: number; nombre: string } | null }
interface Tipo { id: number; nombre: string; campos?: CampoDefinicion[] | null; tienePeriodo?: boolean }
interface Entry { file: File; empleadoId: string; campoValues: Record<string, string> }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; esRecibo?: boolean; employeeId?: number }

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

const DEFAULT_CAMPOS: CampoDefinicion[] = [
  { nombre: 'periodo', label: 'Período', tipo: 'mes_anio', requerido: true },
]

function buildDefaultValues(campos: CampoDefinicion[]): Record<string, string> {
  const now = new Date()
  const defaults: Record<string, string> = {}
  for (const campo of campos) {
    if (campo.tipo === 'mes_anio') {
      defaults[`${campo.nombre}__mes`] = String(now.getMonth() + 1).padStart(2, '0')
      defaults[`${campo.nombre}__ano`] = String(now.getFullYear())
    } else {
      defaults[campo.nombre] = ''
    }
  }
  return defaults
}

export function DocumentoUploadDialog({ open, onClose, onSaved, esRecibo, employeeId }: Props) {
  const router = useRouter()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empleadoFijo, setEmpleadoFijo] = useState<Empleado | null>(null)
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [tipoId, setTipoId] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (employeeId) {
      fetch(`/api/empleados/${employeeId}`).then(r => r.json()).then((e: Empleado) => setEmpleadoFijo(e))
    } else {
      fetch('/api/empleados?all=true&estado=ACTIVO').then(r => r.json()).then(d => setEmpleados(d.employees))
    }
    const RECIBO_TIPO = 'Recibo de Sueldo'
    fetch('/api/configuracion/tipos-documento').then(r => r.json()).then((data: Tipo[]) => {
      const filtered = esRecibo === true
        ? data.filter(t => t.nombre === RECIBO_TIPO)
        : esRecibo === false
          ? data.filter(t => t.nombre !== RECIBO_TIPO)
          : data
      setTipos(filtered)
      if (esRecibo === true) {
        const recibo = filtered.find(t => t.nombre === RECIBO_TIPO)
        if (recibo) setTipoId(String(recibo.id))
      }
    })
    setEntries([])
    if (esRecibo !== true) setTipoId('')
  }, [open, esRecibo, employeeId])

  const selectedTipo = tipos.find(t => String(t.id) === tipoId)
  const activeCampos: CampoDefinicion[] = !selectedTipo
    ? []
    : selectedTipo.campos?.length
      ? selectedTipo.campos
      : selectedTipo.tienePeriodo === false ? [] : DEFAULT_CAMPOS

  // Reset campo values when tipo changes
  useEffect(() => {
    if (!open) return
    const defaults = buildDefaultValues(activeCampos)
    setEntries(prev => prev.map(e => ({ ...e, campoValues: defaults })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId])

  function addFiles(newFiles: File[]) {
    const defaults = buildDefaultValues(activeCampos)
    const eid = employeeId ? String(employeeId) : ''
    setEntries(prev => [...prev, ...newFiles.map(file => ({ file, empleadoId: eid, campoValues: defaults }))])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function setEntryEmpleado(index: number, empleadoId: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, empleadoId } : e))
  }

  function setCampoValue(index: number, key: string, value: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, campoValues: { ...e.campoValues, [key]: value } } : e))
  }

  function buildFormData(entry: Entry): FormData {
    const fd = new FormData()
    fd.append('file', entry.file)
    fd.append('employeeId', entry.empleadoId)
    if (tipoId) fd.append('tipoDocumentoId', tipoId)

    const metadata: Record<string, string> = {}
    for (const campo of activeCampos) {
      if (campo.tipo === 'mes_anio') {
        const mes = entry.campoValues[`${campo.nombre}__mes`]
        const ano = entry.campoValues[`${campo.nombre}__ano`]
        if (mes && ano) {
          if (campo.nombre === 'periodo') {
            fd.append('periodo', `${ano}-${mes}`)
          } else {
            metadata[campo.nombre] = `${ano}-${mes}`
          }
        }
      } else {
        const value = entry.campoValues[campo.nombre]
        if (value?.trim()) metadata[campo.nombre] = value.trim()
      }
    }
    if (Object.keys(metadata).length > 0) {
      fd.append('metadata', JSON.stringify(metadata))
    }
    return fd
  }

  async function handleUpload() {
    if (!entries.length) return
    setLoading(true)
    try {
      const results = await Promise.all(entries.map(async entry => {
        const res = await fetch('/api/documentos', { method: 'POST', body: buildFormData(entry) })
        return { entry, res }
      }))
      const failed = results.filter(r => !r.res.ok)
      const ok = results.length - failed.length

      if (failed.length === 0) {
        toast.success(`${ok} archivo${ok === 1 ? '' : 's'} cargado${ok === 1 ? '' : 's'}`)
        onSaved()
        onClose()
        return
      }

      const firstErr = await parseApiError(failed[0].res)
      const nombre = failed[0].entry.file.name

      if (failed.length === 1) {
        showApiError({ ...firstErr, error: `${nombre}: ${firstErr.error}` }, href => router.push(href))
      } else {
        showApiError({
          ...firstErr,
          error: `${failed.length} de ${results.length} archivos fallaron. Primer error — ${nombre}: ${firstErr.error}`,
        }, href => router.push(href))
      }
      if (ok > 0) {
        toast.success(`${ok} archivo${ok === 1 ? '' : 's'} cargado${ok === 1 ? '' : 's'} correctamente`)
        onSaved()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red al cargar los archivos')
    } finally {
      setLoading(false)
    }
  }

  const canUpload = entries.length > 0 &&
    entries.every(e => {
      if (!e.empleadoId) return false
      for (const campo of activeCampos) {
        if (!campo.requerido) continue
        if (campo.tipo === 'mes_anio') {
          if (!e.campoValues[`${campo.nombre}__mes`] || !e.campoValues[`${campo.nombre}__ano`]) return false
        } else {
          if (!e.campoValues[campo.nombre]?.trim()) return false
        }
      }
      return true
    }) && !loading

  const dialogTitle = esRecibo === true ? 'Cargar Recibo de Sueldo' : 'Cargar Documento'
  const btnLabel = esRecibo === true ? 'Recibo' : 'Documento'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
          {empleadoFijo && (
            <p className="text-xs text-muted-foreground mt-1">
              Para <span className="font-medium text-foreground">{empleadoFijo.apellido}, {empleadoFijo.nombre}</span> ({empleadoFijo.legajo})
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
          {tipos.length > 0 && esRecibo !== true && (
            <div>
              <Label className="mb-1.5">Tipo de documento</Label>
              <Select value={tipoId} onValueChange={v => setTipoId(v ?? '')}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Sin tipo (opcional)" /></SelectTrigger>
                <SelectContent side="bottom" alignItemWithTrigger={false}>
                  <SelectItem value="">Sin tipo</SelectItem>
                  {tipos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className="border-2 border-dashed border-green-300 dark:border-green-800 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 dark:hover:border-green-600 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={20} className="mx-auto mb-1 text-green-600 dark:text-green-400" />
            <p className="text-sm text-muted-foreground">Click para agregar PDFs</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
            />
          </div>

          {entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <div key={i} className="bg-muted/40 rounded-lg px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground truncate" title={entry.file.name}>
                      {entry.file.name}
                    </span>
                    <button onClick={() => removeEntry(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!employeeId && (
                      <EmpleadoPicker
                        value={entry.empleadoId}
                        onChange={v => setEntryEmpleado(i, v)}
                        empleados={empleados}
                        className="flex-1 min-w-40"
                      />
                    )}
                    {activeCampos.map(campo => {
                      if (campo.tipo === 'mes_anio') {
                        return (
                          <Fragment key={campo.nombre}>
                            <Select
                              value={entry.campoValues[`${campo.nombre}__mes`] ?? ''}
                              onValueChange={v => v && setCampoValue(i, `${campo.nombre}__mes`, v)}
                            >
                              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
                              <SelectContent side="bottom" alignItemWithTrigger={false}>
                                {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select
                              value={entry.campoValues[`${campo.nombre}__ano`] ?? ''}
                              onValueChange={v => v && setCampoValue(i, `${campo.nombre}__ano`, v)}
                            >
                              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
                              <SelectContent side="bottom" alignItemWithTrigger={false}>
                                {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Fragment>
                        )
                      }
                      return (
                        <Input
                          key={campo.nombre}
                          type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                          value={entry.campoValues[campo.nombre] ?? ''}
                          onChange={e => setCampoValue(i, campo.nombre, e.target.value)}
                          placeholder={campo.label}
                          className="h-8 text-xs w-36"
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleUpload}
            disabled={!canUpload}
          >
            {loading ? 'Subiendo...' : entries.length > 1 ? `Cargar ${entries.length} ${btnLabel}s` : `Cargar ${btnLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
