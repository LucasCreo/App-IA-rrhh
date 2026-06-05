'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function TabGeneral() {
  const [form, setForm] = useState({ appName: 'RRHH', logoUrl: '', primaryColor: '#166534' })
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/configuracion/general').then(r => r.json()).then(data => {
      if (data) setForm({ appName: data.appName ?? 'RRHH', logoUrl: data.logoUrl ?? '', primaryColor: data.primaryColor ?? '#166534' })
    })
  }, [])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
    const { url } = await res.json()
    setForm(f => ({ ...f, logoUrl: url }))
    setUploading(false)
  }

  async function handleSave() {
    await fetch('/api/configuracion/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración General</CardTitle>
        <CardDescription>Nombre, logo y color de la aplicación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label>Nombre de la aplicación</Label>
          <Input
            value={form.appName}
            onChange={e => setForm(f => ({ ...f, appName: e.target.value }))}
            placeholder="RRHH"
            className="mt-1 max-w-xs"
          />
        </div>
        <div>
          <Label>Logo</Label>
          <div className="mt-1 flex items-center gap-3">
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo" className="h-10 object-contain rounded border p-1 bg-white" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Subiendo…' : form.logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            {form.logoUrl && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setForm(f => ({ ...f, logoUrl: '' }))}
              >
                Quitar
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG. Se mostrará en el sidebar.</p>
        </div>
        <div>
          <Label>Color primario</Label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="color"
              value={form.primaryColor}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="w-10 h-10 rounded cursor-pointer border p-0.5"
            />
            <Input
              value={form.primaryColor}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="w-32 font-mono text-sm"
            />
            <div className="w-8 h-8 rounded border" style={{ backgroundColor: form.primaryColor }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Se aplica al sidebar. Requiere recargar la página para verse.</p>
        </div>
        <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>
          {saved ? '✓ Guardado' : 'Guardar'}
        </Button>
      </CardContent>
    </Card>
  )
}
