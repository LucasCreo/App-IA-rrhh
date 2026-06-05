'use client'

import { useEffect, useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload } from 'lucide-react'

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface Tipo { id: number; nombre: string }
interface Props { open: boolean; onClose: () => void; onSaved: () => void }

export function DocumentoUploadDialog({ open, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [empleadoId, setEmpleadoId] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/empleados?page=1').then(r => r.json()).then(d => setEmpleados(d.employees))
    fetch('/api/configuracion/tipos-documento').then(r => r.json()).then(setTipos)
    setFiles([])
    setEmpleadoId('')
    setPeriodo('')
    setTipoId('')
  }, [open])

  async function handleUpload() {
    if (!files.length || !empleadoId || !periodo) return
    setLoading(true)
    await Promise.all(files.map(file => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('employeeId', empleadoId)
      fd.append('periodo', periodo)
      if (tipoId) fd.append('tipoDocumentoId', tipoId)
      return fetch('/api/documentos', { method: 'POST', body: fd })
    }))
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cargar Recibo de Sueldo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Empleado</Label>
            <Select value={empleadoId} onValueChange={v => setEmpleadoId(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
              <SelectContent>
                {empleados.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.legajo} - {e.apellido}, {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Periodo (YYYY-MM)</Label>
            <Input className="mt-1" placeholder="2024-01" value={periodo} onChange={e => setPeriodo(e.target.value)} />
          </div>
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
          <div>
            <Label>Archivos PDF</Label>
            <div
              className="mt-1 border-2 border-dashed border-green-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-green-600" />
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click para seleccionar uno o varios PDFs</p>
              ) : (
                <ul className="text-sm text-left space-y-1 mt-1">
                  {files.map((f, i) => <li key={i} className="text-muted-foreground truncate">• {f.name}</li>)}
                </ul>
              )}
              <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleUpload}
            disabled={!files.length || !empleadoId || !periodo || loading}
          >
            {loading ? 'Subiendo...' : files.length > 1 ? `Cargar ${files.length} Recibos` : 'Cargar Recibo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
