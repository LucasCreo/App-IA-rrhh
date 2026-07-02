'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

export function TabGeneral() {
  const router = useRouter()
  const [form, setForm] = useState({ appName: 'RRHH', logoUrl: '' })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/configuracion/general').then(r => r.json()).then(data => {
      if (data) setForm({ appName: data.appName ?? 'RRHH', logoUrl: data.logoUrl ?? '' })
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
    const res = await fetch('/api/configuracion/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      toast.error('Error al guardar la configuración')
      return
    }
    toast.success('Configuración guardada')
    router.refresh()
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Configuración General</CardTitle>
        <CardDescription>Nombre y logo de la aplicación.</CardDescription>
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
        <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>
          Guardar
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Manuales de uso</CardTitle>
        <CardDescription>Documentación para administradores y empleados. Se pueden imprimir o guardar como PDF desde el navegador.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link href="/admin/manual" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <BookOpen size={15} />
          Manual de administrador
        </Link>
        <Link href="/empleado/manual" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <BookOpen size={15} />
          Manual de empleado
        </Link>
      </CardContent>
    </Card>
    </div>
  )
}
