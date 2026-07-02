'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function TabFirma() {
  const [form, setForm] = useState({ providerUrl: '', apiKey: '', extraHeaders: '{}', extraBody: '{}' })

  useEffect(() => {
    fetch('/api/configuracion').then(r => r.json()).then(data => {
      if (data) setForm({
        providerUrl: data.providerUrl ?? '',
        apiKey: data.apiKey ?? '',
        extraHeaders: data.extraHeaders ?? '{}',
        extraBody: data.extraBody ?? '{}',
      })
    })
  }, [])

  async function handleSave() {
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const text = await res.text()
        toast.error(`Error ${res.status}: ${text}`)
        return
      }
      toast.success('Configuración guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Proveedor de Firma Electrónica</CardTitle>
          <CardDescription>Datos de conexión con tu proveedor de firma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL del endpoint de firma</Label>
            <Input placeholder="https://proveedor.com/api/sign" value={form.providerUrl} onChange={e => setForm(f => ({ ...f, providerUrl: e.target.value }))} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">POST con el PDF en base64. GET a esta URL/{'{id}'}/status para consultar.</p>
          </div>
          <div>
            <Label>API Key</Label>
            <Input type="password" placeholder="sk-••••••••••••••••" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Headers adicionales (JSON)</Label>
            <Textarea rows={3} placeholder='{"X-Custom-Header": "valor"}' value={form.extraHeaders} onChange={e => setForm(f => ({ ...f, extraHeaders: e.target.value }))} className="mt-1 font-mono text-sm" />
          </div>
          <div>
            <Label>Body adicional (JSON)</Label>
            <Textarea rows={4} placeholder='{"empresa": "Mi Empresa S.A.", "firmante": "Juan Pérez"}' value={form.extraBody} onChange={e => setForm(f => ({ ...f, extraBody: e.target.value }))} className="mt-1 font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Campos extra que se fusionan con el body del request de firma.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
