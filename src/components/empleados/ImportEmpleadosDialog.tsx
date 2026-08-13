'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { Upload, Download, AlertCircle, CheckCircle2, Users } from 'lucide-react'
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

interface ExistingRow { row: number; legajo: string; email: string; cuil: string; matches: string[] }
interface RowError { row: number; email?: string; error: string }

interface Preview {
  preview: true
  total: number
  willCreate: number
  existing: ExistingRow[]
  invalid: RowError[]
  missingCategorias: string[]
  categoriasCreadas: string[]
}

interface Result {
  created: number
  total: number
  errors: RowError[]
  categoriasCreadas?: string[]
  skippedExisting?: ExistingRow[]
}

interface NeedsConfirmation {
  needsConfirmation: true
  missingCategorias: string[]
  total: number
}

export function ImportEmpleadosDialog({ open, onClose, onImported }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [confirmCats, setConfirmCats] = useState<NeedsConfirmation | null>(null)

  function reset() { setFile(null); setPreview(null); setResult(null); setConfirmCats(null) }

  function downloadTemplate() {
    const rows = [
      ['legajo', 'nombre', 'apellido', 'cuil', 'email', 'telefono', 'fechaIngreso', 'categoria', 'username', 'password'],
      ['001', 'Juan', 'Pérez', '20-12345678-9', 'juan.perez@empresa.com', '2611234567', '2024-01-15', 'Operario', 'jperez', 'cambiar123'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
    XLSX.writeFile(wb, 'plantilla-empleados.xlsx')
  }

  async function runPreview(createMissingCategorias = false) {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('preview', 'true')
      if (createMissingCategorias) fd.append('createMissingCategorias', 'true')
      const r = await fetch('/api/empleados/import', { method: 'POST', body: fd })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      const data = await r.json()
      if (data.needsConfirmation) { setConfirmCats(data as NeedsConfirmation); return }
      setPreview(data as Preview)
      setConfirmCats(null)
    } finally {
      setUploading(false)
    }
  }

  async function confirmImport() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('skipExisting', 'true')
      // Si el preview ya reportó que se crearon las categorías, indicarlo
      if (preview && preview.categoriasCreadas.length > 0) fd.append('createMissingCategorias', 'true')
      if (preview && preview.missingCategorias.length > 0 && preview.categoriasCreadas.length === 0) fd.append('createMissingCategorias', 'true')
      const r = await fetch('/api/empleados/import', { method: 'POST', body: fd })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      const data = await r.json()
      if (data.needsConfirmation) { setConfirmCats(data as NeedsConfirmation); return }
      setResult(data as Result)
      setPreview(null)
      if (data.created > 0) {
        toast.success(`${data.created} empleado${data.created !== 1 ? 's' : ''} creado${data.created !== 1 ? 's' : ''}`)
        onImported()
      }
      if (data.categoriasCreadas?.length) {
        toast.success(`${data.categoriasCreadas.length} categoría${data.categoriasCreadas.length !== 1 ? 's' : ''} creada${data.categoriasCreadas.length !== 1 ? 's' : ''}`)
      }
    } finally {
      setUploading(false)
    }
  }

  const showFilePicker = !preview && !result && !confirmCats

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !uploading) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar empleados desde Excel/CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {showFilePicker && (
            <>
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Columnas requeridas: <code>legajo, nombre, apellido, cuil, email, fechaIngreso, categoria, password</code>.
                Opcionales: <code>telefono, username</code>. La categoría se identifica por nombre exacto. Cada empleado debería cambiar su contraseña al primer login.
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
            </>
          )}

          {confirmCats && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3">
              <AlertCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1 min-w-0">
                <p className="text-sm">
                  La planilla incluye <strong>{confirmCats.missingCategorias.length} categoría{confirmCats.missingCategorias.length !== 1 ? 's' : ''}</strong> que no existe{confirmCats.missingCategorias.length !== 1 ? 'n' : ''} todavía:
                </p>
                <div className="flex flex-wrap gap-1">
                  {confirmCats.missingCategorias.map(c => (
                    <span key={c} className="text-xs bg-background border rounded px-2 py-0.5">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">¿Querés crearlas y continuar con la validación?</p>
              </div>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2.5 bg-green-50 dark:bg-green-950/20">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{preview.willCreate}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">A crear</p>
                </div>
                <div className="rounded-md border p-2.5 bg-yellow-50 dark:bg-yellow-950/20">
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{preview.existing.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Ya existen</p>
                </div>
                <div className="rounded-md border p-2.5 bg-red-50 dark:bg-red-950/20">
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{preview.invalid.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Con errores</p>
                </div>
              </div>

              {preview.missingCategorias.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-2.5 text-xs">
                  <AlertCircle size={13} className="text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    Se van a crear <strong>{preview.missingCategorias.length}</strong> categoría{preview.missingCategorias.length !== 1 ? 's' : ''} nueva{preview.missingCategorias.length !== 1 ? 's' : ''}:{' '}
                    {preview.missingCategorias.join(', ')}
                  </div>
                </div>
              )}

              {preview.existing.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                    <Users size={12} /> Empleados que ya existen (se van a omitir)
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5 w-12">Fila</th>
                          <th className="text-left px-2 py-1.5">Legajo</th>
                          <th className="text-left px-2 py-1.5">Email</th>
                          <th className="text-left px-2 py-1.5">Coincide por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.existing.map(e => (
                          <tr key={e.row} className="border-t">
                            <td className="px-2 py-1 font-mono">{e.row}</td>
                            <td className="px-2 py-1">{e.legajo || '—'}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[160px]">{e.email || '—'}</td>
                            <td className="px-2 py-1">
                              {e.matches.map(m => (
                                <span key={m} className="inline-block text-[10px] bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 rounded px-1.5 py-0.5 mr-1">{m}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.invalid.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                    <AlertCircle size={12} /> Filas con errores (no se van a importar)
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5 w-12">Fila</th>
                          <th className="text-left px-2 py-1.5">Email</th>
                          <th className="text-left px-2 py-1.5">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.invalid.map(err => (
                          <tr key={err.row} className="border-t">
                            <td className="px-2 py-1 font-mono">{err.row}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[160px]">{err.email ?? '—'}</td>
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

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border p-3 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <p className="text-sm">
                  <strong>{result.created}</strong> de {result.total} empleado{result.total !== 1 ? 's' : ''} creado{result.created !== 1 ? 's' : ''}.
                  {result.skippedExisting && result.skippedExisting.length > 0 && (
                    <> {result.skippedExisting.length} omitido{result.skippedExisting.length !== 1 ? 's' : ''} por ya existir.</>
                  )}
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
                          <th className="text-left px-2 py-1.5 w-14">Fila</th>
                          <th className="text-left px-2 py-1.5">Email</th>
                          <th className="text-left px-2 py-1.5">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map(err => (
                          <tr key={err.row} className="border-t">
                            <td className="px-2 py-1 font-mono">{err.row}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[160px]">{err.email ?? '—'}</td>
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
          {confirmCats ? (
            <>
              <Button variant="outline" onClick={() => setConfirmCats(null)} disabled={uploading}>Volver</Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={() => runPreview(true)}
                disabled={uploading}
              >
                {uploading ? 'Validando…' : 'Crear categorías y validar'}
              </Button>
            </>
          ) : preview ? (
            <>
              <Button variant="outline" onClick={reset} disabled={uploading}>Cancelar</Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={confirmImport}
                disabled={uploading || preview.willCreate === 0}
              >
                <Upload size={13} className="mr-1.5" />
                {uploading ? 'Importando…' : `Importar ${preview.willCreate}`}
              </Button>
            </>
          ) : !result ? (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={uploading}>Cancelar</Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={() => runPreview(false)}
                disabled={!file || uploading}
              >
                {uploading ? 'Validando…' : 'Validar'}
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
