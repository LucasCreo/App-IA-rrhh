'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Info, Settings2 } from 'lucide-react'

interface InfoData {
  version: string
  counts: { totalUsuarios: number; empleadosActivos: number; totalDocs: number; totalPosts: number }
}

export function TabGeneral() {
  const [info, setInfo] = useState<InfoData | null>(null)

  const [cfg, setCfg] = useState({
    editWindowValor: 24,
    editWindowUnidad: 'hr' as 'min' | 'hr',
    soporteEmail: '',
    soporteTel: '',
    avisosEmpleadosHabilitados: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/info').then(r => r.ok ? r.json() : null).then(d => d && setInfo(d))
    fetch('/api/configuracion/general').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      const mins = d.editWindowMin ?? 1440
      const enHoras = mins % 60 === 0
      setCfg({
        editWindowValor: enHoras ? mins / 60 : mins,
        editWindowUnidad: enHoras ? 'hr' : 'min',
        soporteEmail: d.soporteEmail ?? '',
        soporteTel: d.soporteTel ?? '',
        avisosEmpleadosHabilitados: d.avisosEmpleadosHabilitados ?? true,
      })
    })
  }, [])

  async function guardarCfg() {
    setSaving(true)
    const editWindowMin = cfg.editWindowUnidad === 'hr' ? cfg.editWindowValor * 60 : cfg.editWindowValor
    const r = await fetch('/api/configuracion/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editWindowMin,
        soporteEmail: cfg.soporteEmail,
        soporteTel: cfg.soporteTel,
        avisosEmpleadosHabilitados: cfg.avisosEmpleadosHabilitados,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast.error(d.error ?? 'Error al guardar')
      return
    }
    toast.success('Configuración guardada')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen size={17} /> Manuales de uso</CardTitle>
          <CardDescription>Documentación para administradores y empleados. Se pueden imprimir o guardar como PDF desde el navegador.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/admin/manual" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            <BookOpen size={15} /> Manual de administrador
          </Link>
          <Link href="/manual/empleado" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            <BookOpen size={15} /> Manual de empleado
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 size={17} /> Comportamiento de la app</CardTitle>
          <CardDescription>Ajustes globales que afectan cómo se comportan algunos módulos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5">Ventana de edición de posts/comentarios</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                className="w-32"
                value={cfg.editWindowValor}
                onChange={e => setCfg(c => ({ ...c, editWindowValor: Number(e.target.value) }))}
              />
              <Select value={cfg.editWindowUnidad} onValueChange={v => v && setCfg(c => ({ ...c, editWindowUnidad: v as 'min' | 'hr' }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="min">Minutos</SelectItem>
                  <SelectItem value="hr">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tiempo desde la publicación en que el autor puede editar.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5">Email de soporte</Label>
              <Input
                type="email"
                value={cfg.soporteEmail}
                onChange={e => setCfg(c => ({ ...c, soporteEmail: e.target.value }))}
                placeholder="soporte@empresa.com"
              />
            </div>
            <div>
              <Label className="mb-1.5">Teléfono de soporte</Label>
              <Input
                value={cfg.soporteTel}
                onChange={e => setCfg(c => ({ ...c, soporteTel: e.target.value }))}
                placeholder="+54 11 5555 5555"
              />
            </div>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t">
            <input
              id="avisos-empleados"
              type="checkbox"
              checked={cfg.avisosEmpleadosHabilitados}
              onChange={e => setCfg(c => ({ ...c, avisosEmpleadosHabilitados: e.target.checked }))}
              className="w-4 h-4 accent-green-700 mt-0.5"
            />
            <div>
              <Label htmlFor="avisos-empleados" className="cursor-pointer">Permitir avisos publicados por empleados</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Cuando está apagado, solo los admins pueden publicar en Avisos. Los empleados igual pueden ver y comentar.</p>
            </div>
          </div>
          <Button className="bg-green-700 hover:bg-green-800" onClick={guardarCfg} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info size={17} /> Información del sistema</CardTitle>
          <CardDescription>Datos de la instalación actual.</CardDescription>
        </CardHeader>
        <CardContent>
          {!info ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Versión</dt>
                <dd className="font-medium">{info.version}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Usuarios</dt>
                <dd className="font-medium">{info.counts.totalUsuarios}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Empleados activos</dt>
                <dd className="font-medium">{info.counts.empleadosActivos}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Documentos</dt>
                <dd className="font-medium">{info.counts.totalDocs}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Publicaciones</dt>
                <dd className="font-medium">{info.counts.totalPosts}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
