'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { BookOpen, Info, Settings2, FileSignature, Save } from 'lucide-react'

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

      <FirmaElectronicaCard />

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

interface FirmaState {
  firmaEnabled: boolean
  firmaProveedor: string
  firmaApiUrl: string
  firmaApiKey: string
  firmaApiSecret: string          // input local; si queda vacío no se envía
  firmaApiSecretSet: boolean      // si el server ya tiene guardado
  firmaApiHeaders: string         // JSON serializado
  firmaApiBody: string            // JSON serializado
}

const EMPTY_FIRMA: FirmaState = {
  firmaEnabled: false, firmaProveedor: '', firmaApiUrl: '',
  firmaApiKey: '', firmaApiSecret: '', firmaApiSecretSet: false,
  firmaApiHeaders: '', firmaApiBody: '',
}

function esJsonValido(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  try { JSON.parse(t); return true } catch { return false }
}

function FirmaElectronicaCard() {
  const [cfg, setCfg] = useState<FirmaState>(EMPTY_FIRMA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/firma')
      .then(r => r.ok ? r.json() : null)
      .then((c: Partial<FirmaState> | null) => c && setCfg(prev => ({ ...prev, ...c, firmaApiSecret: '' })))
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof FirmaState>(key: K, value: FirmaState[K]) {
    setCfg(c => ({ ...c, [key]: value }))
  }

  async function save() {
    if (cfg.firmaEnabled) {
      if (!cfg.firmaProveedor.trim() || !cfg.firmaApiUrl.trim() || !cfg.firmaApiKey.trim()) {
        toast.error('Completá proveedor, URL y API Key')
        return
      }
      if (!cfg.firmaApiSecretSet && !cfg.firmaApiSecret) {
        toast.error('Falta el API Secret')
        return
      }
      if (!esJsonValido(cfg.firmaApiHeaders)) {
        toast.error('Headers no es JSON válido')
        return
      }
      if (!esJsonValido(cfg.firmaApiBody)) {
        toast.error('Body no es JSON válido')
        return
      }
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...cfg }
      if (!cfg.firmaApiSecret) delete body.firmaApiSecret
      delete body.firmaApiSecretSet
      const r = await fetch('/api/configuracion/firma', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? `Error ${r.status} al guardar`)
        return
      }
      toast.success('Config de firma guardada')
      setCfg(c => ({
        ...c,
        firmaApiSecretSet: c.firmaApiSecretSet || !!c.firmaApiSecret,
        firmaApiSecret: '',
      }))
    } finally { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSignature size={17} /> Proveedor de firma electrónica</CardTitle>
        <CardDescription className="mt-1">
          Credenciales de la API (POST) del proveedor externo de firma. El endpoint recibe los documentos vía POST autenticado con API Key + Secret. Después, en cada tipo de documento con acción "Firma digital" podés elegir usar contraseña o este proveedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.firmaEnabled}
            onChange={e => update('firmaEnabled', e.target.checked)}
            className="w-4 h-4 accent-green-700"
          />
          Habilitar proveedor externo
        </label>

        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity', !cfg.firmaEnabled && 'opacity-60 pointer-events-none')}>
          <div className="md:col-span-2">
            <Label className="mb-1.5">Proveedor *</Label>
            <Input
              value={cfg.firmaProveedor}
              onChange={e => update('firmaProveedor', e.target.value)}
              placeholder="Ej: Aditus, DocuSign, Signaturit"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5">URL de la API *</Label>
            <Input
              value={cfg.firmaApiUrl}
              onChange={e => update('firmaApiUrl', e.target.value)}
              placeholder="https://api.proveedor.com"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label className="mb-1.5">API Key *</Label>
            <Input
              value={cfg.firmaApiKey}
              onChange={e => update('firmaApiKey', e.target.value)}
              placeholder="ID público o key"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label className="mb-1.5">
              API Secret {cfg.firmaApiSecretSet && <span className="text-green-700 dark:text-green-400 text-xs font-normal">(configurado — dejá vacío para no cambiarlo)</span>}
            </Label>
            <Input
              type="password"
              value={cfg.firmaApiSecret}
              onChange={e => update('firmaApiSecret', e.target.value)}
              placeholder={cfg.firmaApiSecretSet ? '••••••••' : 'secret'}
              autoComplete="new-password"
              className="font-mono text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 flex items-center gap-2">
              Headers (JSON)
              {cfg.firmaApiHeaders && !esJsonValido(cfg.firmaApiHeaders) && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">JSON inválido</span>
              )}
            </Label>
            <Textarea
              value={cfg.firmaApiHeaders}
              onChange={e => update('firmaApiHeaders', e.target.value)}
              placeholder='{"Authorization": "Bearer {apiKey}", "Content-Type": "application/json"}'
              className="font-mono text-xs min-h-24 resize-y"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Objeto con los headers del POST. Podés usar placeholders como <code>{'{apiKey}'}</code> o <code>{'{apiSecret}'}</code>.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 flex items-center gap-2">
              Body (JSON)
              {cfg.firmaApiBody && !esJsonValido(cfg.firmaApiBody) && (
                <span className="text-[11px] font-normal text-red-600 dark:text-red-400">JSON inválido</span>
              )}
            </Label>
            <Textarea
              value={cfg.firmaApiBody}
              onChange={e => update('firmaApiBody', e.target.value)}
              placeholder='{"documentId": "{documentId}", "signerEmail": "{email}", "signerName": "{nombre}"}'
              className="font-mono text-xs min-h-32 resize-y"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Cuerpo del POST que se enviará al proveedor. Placeholders disponibles se resolverán al momento del envío.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-green-700 hover:bg-green-800">
            <Save size={13} className="mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

