'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Paperclip, FileText, X, AlertTriangle } from 'lucide-react'

interface TipoDocumento {
  id: number
  nombre: string
  tienePeriodo?: boolean
}

interface GrupoData {
  id: number
  nombreArchivo: string
  periodo: string | null
  tipoDocumento: { id: number } | null
}

interface Props {
  open: boolean
  grupo: GrupoData
  onClose: () => void
  onSaved: () => void
}

const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]
const CURRENT_YEAR = new Date().getFullYear()

function parsePeriodo(p: string | null): { mes: string; anio: string } {
  const now = new Date()
  const defMes = String(now.getMonth() + 1).padStart(2, '0')
  const defAnio = String(now.getFullYear())
  if (!p) return { mes: defMes, anio: defAnio }
  const m = p.match(/^(\d{4})-(\d{2})$/)
  if (!m) return { mes: defMes, anio: defAnio }
  return { anio: m[1], mes: m[2] }
}

export function DocumentoGrupoEditarDialog({ open, grupo, onClose, onSaved }: Props) {
  const initialPeriodo = parsePeriodo(grupo.periodo)
  const [nombre, setNombre] = useState(grupo.nombreArchivo)
  const [mes, setMes] = useState(initialPeriodo.mes)
  const [anio, setAnio] = useState(initialPeriodo.anio)
  const [tipoId, setTipoId] = useState<string>(grupo.tipoDocumento?.id ? String(grupo.tipoDocumento.id) : 'sin')
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const p = parsePeriodo(grupo.periodo)
    setNombre(grupo.nombreArchivo)
    setMes(p.mes)
    setAnio(p.anio)
    setTipoId(grupo.tipoDocumento?.id ? String(grupo.tipoDocumento.id) : 'sin')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [grupo])

  useEffect(() => {
    fetch('/api/configuracion/tipos-documento')
      .then(r => r.ok ? r.json() : [])
      .then((data: TipoDocumento[]) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => setTipos([]))
  }, [])

  const selectedTipo = useMemo(() => tipos.find(t => String(t.id) === tipoId), [tipos, tipoId])
  const mostrarPeriodo = !!selectedTipo && selectedTipo.tienePeriodo !== false

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return }
    if (!tipoId || tipoId === 'sin') { toast.error('El tipo de documento es requerido'); return }
    setSaving(true)
    try {
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch(`/api/documentos-grupos/${grupo.id}/reemplazar`, { method: 'POST', body: fd })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          toast.error(d.error ?? 'No se pudo reemplazar el archivo')
          return
        }
      }
      const r = await fetch(`/api/documentos-grupos/${grupo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreArchivo: nombre.trim(),
          periodo: mostrarPeriodo ? `${anio}-${mes}` : null,
          tipoDocumentoId: Number(tipoId),
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? 'No se pudo actualizar')
        return
      }
      toast.success(file ? 'Documento y archivo actualizados' : 'Documento actualizado')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) setNombre(f.name)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nombre del archivo</p>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo de documento *</p>
            <Select value={tipoId === 'sin' ? '' : tipoId} onValueChange={v => v && setTipoId(v)}>
              <SelectTrigger className="w-full h-9 text-sm"><SelectValue placeholder="Seleccioná un tipo" /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                {tipos
                  .filter(t => t.nombre.toLowerCase() !== 'recibo de sueldo')
                  .map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-500 mt-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Solo se puede cambiar si todas las asignaciones están en borrador.</span>
            </p>
          </div>

          {mostrarPeriodo && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Período</p>
              <div className="flex gap-2">
                <Select value={mes} onValueChange={v => { if (v) setMes(v) }}>
                  <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" alignItemWithTrigger={false}>
                    {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1900}
                  max={CURRENT_YEAR + 10}
                  value={anio}
                  onChange={e => setAnio(e.target.value)}
                  className="w-24 h-9 text-sm"
                  placeholder="Año"
                />
              </div>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Reemplazar archivo</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onPickFile}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <Paperclip size={13} className="text-green-700 dark:text-green-400 shrink-0" />
                <span className="truncate flex-1 text-green-800 dark:text-green-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); setNombre(grupo.nombreArchivo); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded"
                  title="Descartar"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted/30 mb-2">
                  <FileText size={13} className="text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{grupo.nombreArchivo}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 font-normal"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={13} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Elegir nuevo PDF…</span>
                </Button>
                <p className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-500 mt-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>Reemplazar borra el PDF anterior. Las asignaciones enviadas vuelven a borrador. No se puede si hay firmas realizadas.</span>
                </p>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
