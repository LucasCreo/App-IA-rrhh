'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminHeader } from '@/components/layout/AdminHeader'

interface Result {
  ok: boolean
  id?: string
  sizeBytes?: number
  error?: string
}

export default function AditusTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [objectTitle, setObjectTitle] = useState('')
  const [legajo, setLegajo] = useState('')
  const [cuil, setCuil] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [healthResult, setHealthResult] = useState<unknown>(null)

  // Update
  const [updateId, setUpdateId] = useState('')
  const [updateFile, setUpdateFile] = useState<File | null>(null)
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateLegajo, setUpdateLegajo] = useState('')
  const [updateCuil, setUpdateCuil] = useState('')
  const [updateTipo, setUpdateTipo] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateResult, setUpdateResult] = useState<Result | null>(null)

  // Delete
  const [deleteId, setDeleteId] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState<Result | null>(null)

  // Get
  const [getId, setGetId] = useState('')
  const [getLoading, setGetLoading] = useState(false)
  const [getError, setGetError] = useState<string | null>(null)
  const [getPreview, setGetPreview] = useState<{ url: string; contentType: string; size: number } | null>(null)

  async function subir() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (objectTitle.trim()) fd.append('objectTitle', objectTitle.trim())
      if (legajo.trim()) fd.append('legajo', legajo.trim())
      if (cuil.trim()) fd.append('cuil', cuil.trim())
      if (tipoDocumento.trim()) fd.append('tipoDocumento', tipoDocumento.trim())
      const r = await fetch('/api/aditus/test-upload', { method: 'POST', body: fd })
      const data = await r.json()
      setResult(data)
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setLoading(false)
    }
  }

  async function actualizar() {
    if (!updateFile || !updateId.trim()) return
    setUpdateLoading(true)
    setUpdateResult(null)
    try {
      const fd = new FormData()
      fd.append('id', updateId.trim())
      fd.append('file', updateFile)
      if (updateTitle.trim()) fd.append('objectTitle', updateTitle.trim())
      if (updateLegajo.trim()) fd.append('legajo', updateLegajo.trim())
      if (updateCuil.trim()) fd.append('cuil', updateCuil.trim())
      if (updateTipo.trim()) fd.append('tipoDocumento', updateTipo.trim())
      const r = await fetch('/api/aditus/test-update', { method: 'POST', body: fd })
      const data = await r.json()
      setUpdateResult(data)
    } catch (e) {
      setUpdateResult({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setUpdateLoading(false)
    }
  }

  async function eliminar() {
    if (!deleteId.trim()) return
    setDeleteLoading(true)
    setDeleteResult(null)
    try {
      const r = await fetch('/api/aditus/test-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId.trim() }),
      })
      const data = await r.json()
      setDeleteResult(data)
    } catch (e) {
      setDeleteResult({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setDeleteLoading(false)
    }
  }

  async function descargar() {
    if (!getId.trim()) return
    setGetLoading(true)
    setGetError(null)
    if (getPreview) {
      URL.revokeObjectURL(getPreview.url)
      setGetPreview(null)
    }
    try {
      const r = await fetch(`/api/aditus/test-get?id=${encodeURIComponent(getId.trim())}`)
      if (!r.ok) {
        const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
        setGetError(data?.error || `HTTP ${r.status}`)
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      setGetPreview({ url, contentType: blob.type || 'application/octet-stream', size: blob.size })
    } catch (e) {
      setGetError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setGetLoading(false)
    }
  }

  async function health(force = false) {
    setHealthResult(null)
    const r = await fetch(`/api/aditus/health${force ? '?force=true' : ''}`)
    setHealthResult(await r.json())
  }

  return (
    <>
      <AdminHeader title="Aditus — Test" />
      <div className="p-6 max-w-2xl space-y-6">
        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">1. Test de token (Keycloak)</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => health(false)}>Ver estado</Button>
            <Button variant="outline" size="sm" onClick={() => health(true)}>Forzar refresh</Button>
          </div>
          {healthResult !== null && (
            <pre className="text-xs bg-muted rounded p-3 overflow-auto">{JSON.stringify(healthResult, null, 2)}</pre>
          )}
        </section>

        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">2. Test de upload</h2>

          <div>
            <Label className="mb-1.5">Archivo</Label>
            <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <Label className="mb-1.5">Object title (opcional)</Label>
            <Input value={objectTitle} onChange={e => setObjectTitle(e.target.value)} placeholder="Default: nombre del archivo" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="mb-1.5">Legajo (opcional)</Label>
              <Input value={legajo} onChange={e => setLegajo(e.target.value)} placeholder="ej: 1234" />
            </div>
            <div>
              <Label className="mb-1.5">CUIL (opcional)</Label>
              <Input value={cuil} onChange={e => setCuil(e.target.value)} placeholder="ej: 20-12345678-9" />
            </div>
            <div>
              <Label className="mb-1.5">Tipo de documento (opcional)</Label>
              <Input value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)} placeholder="ej: Recibo" />
            </div>
          </div>

          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={subir}
            disabled={!file || loading}
          >
            {loading ? 'Subiendo…' : 'Subir a Aditus'}
          </Button>

          {result && (
            <pre className={`text-xs rounded p-3 overflow-auto ${result.ok ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </section>

        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">3. Test de update (reemplazar)</h2>

          <div>
            <Label className="mb-1.5">ID del documento en Aditus</Label>
            <Input value={updateId} onChange={e => setUpdateId(e.target.value)} placeholder="pegá el id devuelto por la subida" />
          </div>

          <div>
            <Label className="mb-1.5">Nuevo archivo</Label>
            <Input type="file" onChange={e => setUpdateFile(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <Label className="mb-1.5">Object title (opcional)</Label>
            <Input value={updateTitle} onChange={e => setUpdateTitle(e.target.value)} placeholder="Default: nombre del archivo" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="mb-1.5">Legajo (opcional)</Label>
              <Input value={updateLegajo} onChange={e => setUpdateLegajo(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">CUIL (opcional)</Label>
              <Input value={updateCuil} onChange={e => setUpdateCuil(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Tipo (opcional)</Label>
              <Input value={updateTipo} onChange={e => setUpdateTipo(e.target.value)} />
            </div>
          </div>

          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={actualizar}
            disabled={!updateFile || !updateId.trim() || updateLoading}
          >
            {updateLoading ? 'Actualizando…' : 'Reemplazar en Aditus'}
          </Button>

          {updateResult && (
            <pre className={`text-xs rounded p-3 overflow-auto ${updateResult.ok ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              {JSON.stringify(updateResult, null, 2)}
            </pre>
          )}
        </section>

        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">4. Test de delete (eliminar)</h2>

          <div>
            <Label className="mb-1.5">ID del documento en Aditus</Label>
            <Input value={deleteId} onChange={e => setDeleteId(e.target.value)} placeholder="pegá el id a eliminar" />
          </div>

          <Button
            className="bg-red-700 hover:bg-red-800"
            onClick={eliminar}
            disabled={!deleteId.trim() || deleteLoading}
          >
            {deleteLoading ? 'Eliminando…' : 'Eliminar de Aditus'}
          </Button>

          {deleteResult && (
            <pre className={`text-xs rounded p-3 overflow-auto ${deleteResult.ok ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              {JSON.stringify(deleteResult, null, 2)}
            </pre>
          )}
        </section>

        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">5. Test de get (descargar / previsualizar)</h2>

          <div>
            <Label className="mb-1.5">ID del documento en Aditus</Label>
            <Input value={getId} onChange={e => setGetId(e.target.value)} placeholder="pegá el id a descargar" />
          </div>

          <Button
            className="bg-blue-700 hover:bg-blue-800"
            onClick={descargar}
            disabled={!getId.trim() || getLoading}
          >
            {getLoading ? 'Descargando…' : 'Descargar de Aditus'}
          </Button>

          {getError && (
            <pre className="text-xs rounded p-3 overflow-auto bg-red-50 dark:bg-red-950/20">{getError}</pre>
          )}

          {getPreview && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {getPreview.contentType} · {(getPreview.size / 1024).toFixed(1)} KB
                {' · '}
                <a href={`/api/aditus/test-get?id=${encodeURIComponent(getId.trim())}&download=true`} className="underline">descargar</a>
              </div>
              {getPreview.contentType.startsWith('image/') ? (
                <img src={getPreview.url} alt="preview" className="max-h-96 rounded border" />
              ) : getPreview.contentType.includes('pdf') ? (
                <iframe src={getPreview.url} className="w-full h-96 rounded border" />
              ) : (
                <div className="text-xs text-muted-foreground">Sin preview para este tipo.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
