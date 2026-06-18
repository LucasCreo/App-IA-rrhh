'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X } from 'lucide-react'

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface Tipo { id: number; nombre: string }
interface Entry { file: File; empleadoId: string; mes: string; ano: string }
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

export function DocumentoUploadDialog({ open, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [tipoId, setTipoId] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/empleados?all=true&estado=ACTIVO').then(r => r.json()).then(d => setEmpleados(d.employees))
    fetch('/api/configuracion/tipos-documento').then(r => r.json()).then(setTipos)
    setEntries([])
    setTipoId('')
  }, [open])

  function addFiles(newFiles: File[]) {
    const defaultMes = String(new Date().getMonth() + 1).padStart(2, '0')
    const defaultAno = String(new Date().getFullYear())
    setEntries(prev => [...prev, ...newFiles.map(file => ({ file, empleadoId: '', mes: defaultMes, ano: defaultAno }))])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function setEntryEmpleado(index: number, empleadoId: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, empleadoId } : e))
  }

  function setEntryMes(index: number, mes: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, mes } : e))
  }

  function setEntryAno(index: number, ano: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ano } : e))
  }

  async function handleUpload() {
    if (!entries.length) return
    setLoading(true)
    try {
      const results = await Promise.all(entries.map(({ file, empleadoId, mes, ano }) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('employeeId', empleadoId)
        fd.append('periodo', `${ano}-${mes}`)
        if (tipoId) fd.append('tipoDocumentoId', tipoId)
        return fetch('/api/documentos', { method: 'POST', body: fd })
      }))
      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        toast.error(`${failed.length} archivo(s) no pudieron cargarse`)
        return
      }
      onSaved()
      onClose()
    } catch {
      toast.error('Error al cargar los archivos')
    } finally {
      setLoading(false)
    }
  }

  const canUpload = entries.length > 0 && entries.every(e => e.empleadoId && e.mes && e.ano) && !loading

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Cargar Recibo de Sueldo</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
          {tipos.length > 0 && (
            <div>
              <Label>Tipo de documento</Label>
              <Select value={tipoId} onValueChange={v => setTipoId(v ?? '')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin tipo (opcional)" /></SelectTrigger>
                <SelectContent>
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
                  <div className="flex gap-2">
                    <Select value={entry.empleadoId} onValueChange={v => setEntryEmpleado(i, v ?? '')}>
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue placeholder="Empleado…" />
                      </SelectTrigger>
                      <SelectContent>
                        {empleados.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.legajo} — {e.apellido}, {e.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={entry.mes} onValueChange={v => setEntryMes(i, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={entry.ano} onValueChange={v => setEntryAno(i, v)}>
                      <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
            {loading ? 'Subiendo...' : entries.length > 1 ? `Cargar ${entries.length} Recibos` : 'Cargar Recibo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
