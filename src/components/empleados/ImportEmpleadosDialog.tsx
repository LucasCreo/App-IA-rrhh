'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface Result {
  created: number
  total: number
  errors: { row: number; error: string }[]
}

export function ImportEmpleadosDialog({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [defaultPassword, setDefaultPassword] = useState('cambiar123')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function reset() { setFile(null); setResult(null); setDefaultPassword('cambiar123') }

  function downloadTemplate() {
    const rows = [
      ['legajo', 'nombre', 'apellido', 'cuil', 'email', 'telefono', 'fechaIngreso', 'categoria'],
      ['001', 'Juan', 'Pérez', '20-12345678-9', 'juan.perez@empresa.com', '2611234567', '2024-01-15', 'Operario'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
    XLSX.writeFile(wb, 'plantilla-empleados.xlsx')
  }

  async function handleImport() {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('defaultPassword', defaultPassword)
      const r = await fetch('/api/empleados/import', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error ?? 'Error al importar'); return }
      setResult(data)
      if (data.created > 0) {
        toast.success(`${data.created} empleado${data.created !== 1 ? 's' : ''} creado${data.created !== 1 ? 's' : ''}`)
        onImported()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !uploading) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar empleados desde Excel/CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result && (
            <>
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Columnas requeridas: <code>legajo, nombre, apellido, cuil, email, fechaIngreso, categoria</code>.
                Opcionales: <code>telefono</code>. La categoría se identifica por nombre exacto.
              </div>

              <Button variant="outline" size="sm" onClick={downloadTemplate} type="button">
                <Download size={13} className="mr-1.5" />
                Descargar plantilla
              </Button>

              <div>
                <Label className="mb-1.5">Archivo (.xlsx, .xls, .csv)</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div>
                <Label className="mb-1.5">Contraseña por defecto</Label>
                <Input
                  value={defaultPassword}
                  onChange={e => setDefaultPassword(e.target.value)}
                  placeholder="cambiar123"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Todos los usuarios se crean con esta contraseña. Cada uno debería cambiarla al primer login.
                </p>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border p-3 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <p className="text-sm">
                  <strong>{result.created}</strong> de {result.total} empleado{result.total !== 1 ? 's' : ''} creado{result.created !== 1 ? 's' : ''}.
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle size={14} />
                    <strong>{result.errors.length} error{result.errors.length !== 1 ? 'es' : ''}</strong>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-2 py-1.5 w-16">Fila</th>
                          <th className="text-left px-2 py-1.5">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map(err => (
                          <tr key={err.row} className="border-t">
                            <td className="px-2 py-1 font-mono">{err.row}</td>
                            <td className="px-2 py-1">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={uploading}>Cancelar</Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={handleImport}
                disabled={!file || uploading || defaultPassword.length < 6}
              >
                <Upload size={13} className="mr-1.5" />
                {uploading ? 'Importando…' : 'Importar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>Importar otro</Button>
              <Button className="bg-green-700 hover:bg-green-800" onClick={() => { reset(); onClose() }}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
