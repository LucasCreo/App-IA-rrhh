'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, Activity, Info, Link2, Settings2, RefreshCw, Check, X } from 'lucide-react'

interface InfoData {
  version: string
  lastMigration: string | null
  counts: { totalUsuarios: number; empleadosActivos: number; totalDocs: number; totalPosts: number }
}
interface HealthItem { ok: boolean; detail: string }
type HealthData = Record<string, HealthItem>

export function TabGeneral() {
  const [info, setInfo] = useState<InfoData | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  const [cfg, setCfg] = useState({ editWindowMin: 1440, firmaMinSec: 10, soporteEmail: '', soporteTel: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/info').then(r => r.ok ? r.json() : null).then(d => d && setInfo(d))
    cargarHealth()
    fetch('/api/configuracion/general').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      setCfg({
        editWindowMin: d.editWindowMin ?? 1440,
        firmaMinSec: d.firmaMinSec ?? 10,
        soporteEmail: d.soporteEmail ?? '',
        soporteTel: d.soporteTel ?? '',
      })
    })
  }, [])

  async function cargarHealth() {
    setCheckingHealth(true)
    try {
      const r = await fetch('/api/configuracion/health')
      if (r.ok) setHealth(await r.json())
    } finally {
      setCheckingHealth(false)
    }
  }

  async function guardarCfg() {
    setSaving(true)
    const r = await fetch('/api/configuracion/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    setSaving(false)
    if (!r.ok) { toast.error('Error al guardar'); return }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5">Ventana de edición de posts/comentarios (minutos)</Label>
              <Input
                type="number"
                min={0}
                value={cfg.editWindowMin}
                onChange={e => setCfg(c => ({ ...c, editWindowMin: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Tiempo desde la publicación en que el autor puede editar. 1440 = 24 horas.</p>
            </div>
            <div>
              <Label className="mb-1.5">Tiempo mínimo de lectura antes de firmar (segundos)</Label>
              <Input
                type="number"
                min={0}
                value={cfg.firmaMinSec}
                onChange={e => setCfg(c => ({ ...c, firmaMinSec: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Delay del botón Continuar en el visor de firma.</p>
            </div>
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
                <dt className="text-xs text-muted-foreground">Última migración</dt>
                <dd className="font-medium font-mono text-xs">{info.lastMigration ?? '—'}</dd>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Activity size={17} /> Estado de servicios</CardTitle>
              <CardDescription>Chequeo rápido de las dependencias externas.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={cargarHealth} disabled={checkingHealth}>
              <RefreshCw size={13} className={checkingHealth ? 'animate-spin mr-1.5' : 'mr-1.5'} />
              {checkingHealth ? 'Chequeando…' : 'Chequear'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!health ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ul className="divide-y">
              {Object.entries(health).map(([nombre, item]) => (
                <li key={nombre} className="py-2 flex items-start gap-3">
                  {item.ok
                    ? <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    : <X size={16} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{nombre}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 size={17} /> Enlaces útiles</CardTitle>
          <CardDescription>Contacto de soporte y recursos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cfg.soporteEmail && (
            <p>
              <span className="text-muted-foreground">Email de soporte: </span>
              <a href={`mailto:${cfg.soporteEmail}`} className="text-green-700 dark:text-green-400 hover:underline">{cfg.soporteEmail}</a>
            </p>
          )}
          {cfg.soporteTel && (
            <p>
              <span className="text-muted-foreground">Teléfono de soporte: </span>
              <span>{cfg.soporteTel}</span>
            </p>
          )}
          {!cfg.soporteEmail && !cfg.soporteTel && (
            <p className="text-muted-foreground text-xs">
              Configurá los datos de contacto en la sección <em>Comportamiento de la app</em>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
