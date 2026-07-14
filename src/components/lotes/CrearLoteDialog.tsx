'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react'
import { EmpleadoDialog } from '@/components/empleados/EmpleadoDialog'

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface DetectedData { legajo: string | null; cuil: string | null; nombre: string | null; apellido: string | null }
interface Entry {
  file: File
  empleadoId: string
  legajoDetectado: string | null
  cuilDetectado: string | null
  nombreDetectado: string | null
  apellidoDetectado: string | null
  matched: boolean
  detectando: boolean
}
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

async function detectarLegajoPdf(file: File): Promise<DetectedData> {
  const empty: DetectedData = { legajo: null, cuil: null, nombre: null, apellido: null }
  try {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/lotes/detectar-legajo', { method: 'POST', body: fd })
    if (!r.ok) return empty
    const data = await r.json()
    return {
      legajo: data.legajo ?? null,
      cuil: data.cuil ?? null,
      nombre: data.nombre ?? null,
      apellido: data.apellido ?? null,
    }
  } catch {
    return empty
  }
}

export function CrearLoteDialog({ open, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [creatingEmp, setCreatingEmp] = useState<{ entryIndex: number; prefill: any } | null>(null)

  async function refreshEmpleadosAndAssign(entryIndex: number, legajo: string | null) {
    const r = await fetch('/api/empleados?all=true&estado=ACTIVO')
    const d = await r.json()
    const list: Empleado[] = d.employees ?? []
    setEmpleados(list)
    const nuevo = legajo ? list.find(e => e.legajo === legajo) : undefined
    if (nuevo) {
      setEntries(prev => prev.map((e, i) => i !== entryIndex ? e : { ...e, empleadoId: String(nuevo.id), matched: true }))
    }
  }

  useEffect(() => {
    if (!open) return
    fetch('/api/empleados?all=true&estado=ACTIVO')
      .then(r => r.json())
      .then(d => setEmpleados(d.employees ?? []))
    setNombre('')
    setDescripcion('')
    setEntries([])
  }, [open])

  function addFiles(files: File[], currentEmpleados: Empleado[]) {
    const startIndex = entries.length
    setEntries(prev => [
      ...prev,
      ...files.map(file => ({
        file, legajoDetectado: null, cuilDetectado: null, nombreDetectado: null, apellidoDetectado: null,
        empleadoId: '', matched: false, detectando: true,
      })),
    ])

    files.forEach((file, i) => {
      const targetIndex = startIndex + i
      detectarLegajoPdf(file).then(detected => {
        const emp = detected.legajo
          ? currentEmpleados.find(e => e.legajo === detected.legajo)
          : undefined
        setEntries(prev => prev.map((entry, idx) => {
          if (idx !== targetIndex) return entry
          return {
            ...entry,
            legajoDetectado: detected.legajo,
            cuilDetectado: detected.cuil,
            nombreDetectado: detected.nombre,
            apellidoDetectado: detected.apellido,
            empleadoId: emp ? String(emp.id) : '',
            matched: !!emp,
            detectando: false,
          }
        }))
      })
    })
  }

  function setEntryEmpleado(index: number, empleadoId: string) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e
      return { ...e, empleadoId, matched: empleados.some(em => String(em.id) === empleadoId), detectando: false }
    }))
  }

  async function handleSubmit() {
    if (!nombre.trim()) { toast.error('Ingresá un nombre para el lote'); return }
    const invalid = entries.filter(e => !e.empleadoId)
    if (invalid.length > 0) { toast.error(`${invalid.length} archivo(s) sin empleado asignado`); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('nombre', nombre.trim())
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim())
      fd.append('periodo', `${ano}-${mes}`)
      entries.forEach((e, i) => {
        fd.append(`file_${i}`, e.file)
        fd.append(`employeeId_${i}`, e.empleadoId)
      })

      const r = await fetch('/api/lotes', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error ?? 'Error al crear el lote'); return }

      if (data.errors?.length > 0) {
        toast.warning(`Lote creado con ${data.uploaded} recibo(s). ${data.errors.length} no pudieron subirse.`)
      } else {
        toast.success(`Lote creado — ${data.uploaded} recibo(s) cargados`)
      }
      onSaved()
    } catch {
      toast.error('Error al crear el lote')
    } finally {
      setLoading(false)
    }
  }

  const detectandoCount = entries.filter(e => e.detectando).length
  const canSubmit = !!nombre.trim() && entries.every(e => e.empleadoId) && !loading && detectandoCount === 0
  const pendingCount = entries.filter(e => !e.empleadoId && !e.detectando).length

  return (
    <>
    <Dialog open={open && !creatingEmp} onOpenChange={v => { if (!v && !creatingEmp) onClose() }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Nuevo Lote de Recibos</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
          {/* Nombre */}
          <div>
            <Label>Nombre del lote</Label>
            <Input
              className="mt-1"
              placeholder="Ej: Recibos Junio 2026"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
          </div>

          {/* Descripcion */}
          <div>
            <Label>Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              placeholder="Notas internas sobre este lote…"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          {/* Periodo */}
          <div>
            <Label>Período</Label>
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

          {/* Upload area */}
          <div>
            <Label>Archivos PDF</Label>
            <div
              className="mt-1 border-2 border-dashed border-green-300 dark:border-green-800 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 dark:hover:border-green-600 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={20} className="mx-auto mb-1 text-green-600 dark:text-green-400" />
              <p className="text-sm text-muted-foreground">Click para agregar PDFs</p>
              <p className="text-xs text-muted-foreground mt-0.5">El legajo se detecta automáticamente del contenido del PDF</p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={e => {
                  addFiles(Array.from(e.target.files ?? []), empleados)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {/* File entries */}
          {entries.length > 0 && (
            <div className="space-y-2">
              {pendingCount > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  {pendingCount} archivo(s) sin empleado asignado — revisalos antes de continuar
                </p>
              )}
              {entries.map((entry, i) => (
                <div key={i} className="bg-muted/40 rounded-lg px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.detectando
                        ? <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-green-600 animate-spin" />
                        : entry.empleadoId
                          ? <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                          : <AlertCircle size={14} className="text-yellow-500 shrink-0" />
                      }
                      <span className="text-xs font-medium truncate">{entry.file.name}</span>
                      {entry.detectando ? (
                        <span className="text-xs text-muted-foreground shrink-0">detectando legajo…</span>
                      ) : entry.legajoDetectado && entry.matched ? (
                        <span className="text-xs text-muted-foreground shrink-0">
                          legajo detectado: {entry.legajoDetectado}
                        </span>
                      ) : entry.legajoDetectado ? (
                        <span className="text-xs text-yellow-600 dark:text-yellow-500 shrink-0">
                          legajo {entry.legajoDetectado} no existe en el sistema
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-600 dark:text-yellow-500 shrink-0">sin legajo detectado</span>
                      )}
                    </div>
                    <button
                      onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Select value={entry.empleadoId} onValueChange={v => setEntryEmpleado(i, v ?? '')}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Seleccioná el empleado…" />
                      </SelectTrigger>
                      <SelectContent>
                        {empleados.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {`${e.legajo} — ${e.apellido}, ${e.nombre}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!entry.detectando && entry.legajoDetectado && !entry.matched && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        onClick={() => setCreatingEmp({
                          entryIndex: i,
                          prefill: {
                            legajo: entry.legajoDetectado ?? '',
                            cuil: '', nombre: '', apellido: '',
                            email: '', telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO',
                          },
                        })}
                      >
                        <UserPlus size={12} className="mr-1" /> Crear empleado
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? 'Creando...' : entries.length > 0 ? `Crear Lote (${entries.length} recibo${entries.length !== 1 ? 's' : ''})` : 'Crear Lote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {creatingEmp && (
      <EmpleadoDialog
        open={true}
        onClose={() => setCreatingEmp(null)}
        onSaved={() => {
          const legajo = creatingEmp.prefill.legajo || null
          const idx = creatingEmp.entryIndex
          setCreatingEmp(null)
          refreshEmpleadosAndAssign(idx, legajo)
        }}
        empleado={creatingEmp.prefill}
      />
    )}
    </>
  )
}
