'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Save, GripVertical, Cloud, CheckCircle2, XCircle, ArrowUp, ArrowDown, FileSignature } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { plantillaARegex } from '@/lib/recibosDetect'
import { PatternInput } from './PatternInput'
import { cn } from '@/lib/utils'

const PLACEHOLDERS = [
  { tag: '{legajo}', desc: 'Requerido. Número de legajo.' },
  { tag: '{cuil}', desc: 'CUIL (11 dígitos).' },
  { tag: '{año}', desc: 'Año (4 dígitos).' },
  { tag: '{mes}', desc: 'Mes (1 o 2 dígitos).' },
  { tag: '{apellido}', desc: 'Apellido del empleado.' },
  { tag: '{nombre}', desc: 'Nombre del empleado.' },
  { tag: '{*}', desc: 'Comodín — cualquier texto.' },
]

export function TabRecibos() {
  const [patterns, setPatterns] = useState<string[]>([])
  const [testFilename, setTestFilename] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/general')
      .then(r => r.json())
      .then(cfg => {
        try {
          const parsed = cfg?.reciboFilenamePatterns ? JSON.parse(cfg.reciboFilenamePatterns) : []
          setPatterns(Array.isArray(parsed) ? parsed : [])
        } catch { setPatterns([]) }
      })
      .finally(() => setLoading(false))
  }, [])

  function updatePattern(i: number, value: string) {
    setPatterns(prev => prev.map((p, idx) => idx === i ? value : p))
  }
  function removePattern(i: number) {
    setPatterns(prev => prev.filter((_, idx) => idx !== i))
  }
  function addPattern() {
    setPatterns(prev => [...prev, ''])
  }
  function movePattern(from: number, to: number) {
    setPatterns(prev => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      return next
    })
  }

  async function save() {
    const clean = patterns.map(p => p.trim()).filter(Boolean)
    const invalid = clean.filter(p => plantillaARegex(p) === null)
    if (invalid.length > 0) {
      toast.error(`Patrón inválido: ${invalid[0]} — debe incluir {legajo}`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reciboFilenamePatterns: clean }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? `Error ${res.status} al guardar`)
        console.error('[TabRecibos] guardar:', res.status, data)
        return
      }
      setPatterns(clean)
      toast.success('Patrones guardados')
    } finally { setSaving(false) }
  }

  function testMatch(p: string): { ok: boolean; label: string } {
    if (!testFilename.trim() || !p.trim()) return { ok: false, label: '' }
    const re = plantillaARegex(p)
    if (!re) return { ok: false, label: 'patrón inválido' }
    const m = testFilename.match(re)
    return m && m[1]
      ? { ok: true, label: `matchea → legajo "${m[1]}"` }
      : { ok: false, label: 'no matchea' }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-6">
      <MetodoFirmaReciboCard />

      <Card>
        <CardHeader>
          <CardTitle>Detección de legajo por nombre de archivo</CardTitle>
          <CardDescription className="mt-1">
            Arrastrá las variables al patrón, o escribilos entre llaves. El sistema prueba cada patrón en orden
            y cae al matcheo genérico si ninguno coincide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Variables arrastrables */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Variables disponibles (arrastrá al patrón)</p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map(p => (
                <div
                  key={p.tag}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', p.tag); e.dataTransfer.effectAllowed = 'copy' }}
                  title={p.desc}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-mono border border-border bg-muted text-muted-foreground hover:bg-muted/70 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={11} className="opacity-60" />
                  {p.tag}
                </div>
              ))}
            </div>
          </div>

          {/* Patrones */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-muted-foreground">Patrones</p>
              {patterns.length > 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Se evalúan de arriba hacia abajo — el primero que matchee gana.
                </p>
              )}
            </div>
            {patterns.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Sin patrones configurados. Se usa detección genérica.
              </p>
            )}
            {patterns.map((p, i) => {
              const test = testMatch(p)
              const invalidPattern = p.trim() && plantillaARegex(p) === null
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                    <button
                      onClick={() => movePattern(i, i - 1)}
                      disabled={i === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Subir"
                      aria-label="Subir patrón"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => movePattern(i, i + 1)}
                      disabled={i === patterns.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Bajar"
                      aria-label="Bajar patrón"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <PatternInput
                      value={p}
                      onChange={v => updatePattern(i, v)}
                      placeholder="Ej: {legajo}_{apellido}.pdf"
                    />
                    {invalidPattern && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Patrón inválido — asegurate de incluir {'{legajo}'}
                      </p>
                    )}
                    {test.label && !invalidPattern && (
                      <p className={cn('text-xs mt-1', test.ok ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>
                        {test.label}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removePattern(i)}
                    className="p-2 text-muted-foreground hover:text-destructive shrink-0"
                    title="Eliminar patrón"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
            <Button size="sm" variant="outline" onClick={addPattern}>
              <Plus size={13} className="mr-1.5" /> Agregar patrón
            </Button>
          </div>

          {/* Test */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Probá con un nombre de archivo real:</p>
            <Input
              value={testFilename}
              onChange={e => setTestFilename(e.target.value)}
              placeholder="Ej: 1234_gomez.pdf"
              className="font-mono text-sm max-w-md"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-green-700 hover:bg-green-800">
              <Save size={13} className="mr-1.5" />
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SftpConfigCard />
    </div>
  )
}

interface SftpConfigState {
  sftpEnabled: boolean
  sftpHost: string
  sftpPort: number
  sftpUser: string
  sftpPassword: string          // input local, si vacío no se envía
  sftpPasswordSet: boolean      // si el server ya tiene guardado
  sftpIncomingPath: string
  sftpProcessedPath: string
  sftpErrorsPath: string
  sftpPollIntervalMinutes: number
  sftpStableSeconds: number
}

const EMPTY_SFTP: SftpConfigState = {
  sftpEnabled: false, sftpHost: '', sftpPort: 22, sftpUser: '', sftpPassword: '', sftpPasswordSet: false,
  sftpIncomingPath: '', sftpProcessedPath: '', sftpErrorsPath: '',
  sftpPollIntervalMinutes: 15, sftpStableSeconds: 30,
}

function SftpConfigCard() {
  const [cfg, setCfg] = useState<SftpConfigState>(EMPTY_SFTP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/configuracion/sftp')
      .then(r => r.json())
      .then((c: Partial<SftpConfigState>) => setCfg(prev => ({ ...prev, ...c, sftpPassword: '' })))
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof SftpConfigState>(key: K, value: SftpConfigState[K]) {
    setCfg(c => ({ ...c, [key]: value }))
    setTestResult(null)
  }

  async function save() {
    if (cfg.sftpEnabled) {
      if (!cfg.sftpHost.trim() || !cfg.sftpUser.trim() || !cfg.sftpIncomingPath.trim() || !cfg.sftpProcessedPath.trim()) {
        toast.error('Completá host, usuario y las rutas incoming/processed')
        return
      }
      if (!cfg.sftpPasswordSet && !cfg.sftpPassword) {
        toast.error('Falta el password')
        return
      }
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...cfg }
      if (!cfg.sftpPassword) delete body.sftpPassword
      delete body.sftpPasswordSet
      const r = await fetch('/api/configuracion/sftp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? `Error ${r.status} al guardar`)
        return
      }
      toast.success('Config SFTP guardada')
      setCfg(c => ({
        ...c,
        sftpPasswordSet: c.sftpPasswordSet || !!c.sftpPassword,
        sftpPassword: '',
      }))
    } finally { setSaving(false) }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/configuracion/sftp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sftpHost: cfg.sftpHost,
          sftpUser: cfg.sftpUser,
          sftpPort: cfg.sftpPort,
          sftpIncomingPath: cfg.sftpIncomingPath,
          ...(cfg.sftpPassword ? { sftpPassword: cfg.sftpPassword } : {}),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.ok) {
        setTestResult({ ok: true, msg: `Conexión OK — ${d.pdfsCount} PDF(s) en la carpeta (${d.totalItems} items totales)` })
      } else {
        setTestResult({ ok: false, msg: d.error ?? 'No se pudo conectar' })
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de red' })
    } finally { setTesting(false) }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={18} /> Ingesta SFTP de recibos
        </CardTitle>
        <CardDescription className="mt-1">
          Configurá un servidor SFTP para que el sistema ingiera automáticamente los PDFs de recibos.
          Cada archivo se agrupa en un lote por mes según el nomenclador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <span className="mt-0.5">⚠</span>
          <span>
            Feature en preparación. El proceso automático todavía no está desplegado en el server:
            podés configurarlo, pero la ingesta no va a ejecutarse hasta que se levante el contenedor del worker.
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.sftpEnabled}
            onChange={e => update('sftpEnabled', e.target.checked)}
            className="w-4 h-4 accent-green-700"
          />
          Habilitar ingesta automática
        </label>

        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity', !cfg.sftpEnabled && 'opacity-60 pointer-events-none')}>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Host *</p>
            <Input value={cfg.sftpHost} onChange={e => update('sftpHost', e.target.value)} placeholder="sftp.ejemplo.com" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Puerto</p>
            <Input type="number" value={cfg.sftpPort} onChange={e => update('sftpPort', Number(e.target.value) || 22)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Usuario *</p>
            <Input value={cfg.sftpUser} onChange={e => update('sftpUser', e.target.value)} placeholder="usuario_sftp" />
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">
              Password {cfg.sftpPasswordSet && <span className="text-green-700 dark:text-green-400">(configurado — dejá vacío para no cambiarlo)</span>}
            </p>
            <Input
              type="password"
              value={cfg.sftpPassword}
              onChange={e => update('sftpPassword', e.target.value)}
              placeholder={cfg.sftpPasswordSet ? '••••••••' : 'password'}
              autoComplete="new-password"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ruta de entrada *</p>
            <Input value={cfg.sftpIncomingPath} onChange={e => update('sftpIncomingPath', e.target.value)} placeholder="/upload/recibos" className="font-mono text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ruta processed *</p>
            <Input value={cfg.sftpProcessedPath} onChange={e => update('sftpProcessedPath', e.target.value)} placeholder="/upload/recibos/processed" className="font-mono text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1" title="Si está vacío, los fallidos se mueven a la ruta processed">
              Ruta errores
            </p>
            <Input value={cfg.sftpErrorsPath} onChange={e => update('sftpErrorsPath', e.target.value)} placeholder="/upload/recibos/errors" className="font-mono text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Intervalo de polling (min)</p>
            <Input type="number" min={1} value={cfg.sftpPollIntervalMinutes}
              onChange={e => update('sftpPollIntervalMinutes', Math.max(1, Number(e.target.value) || 15))} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1" title="Espera N segundos desde la última modificación para leer un archivo (evita leer en escritura)">
              Espera de estabilidad (seg)
            </p>
            <Input type="number" min={0} value={cfg.sftpStableSeconds}
              onChange={e => update('sftpStableSeconds', Math.max(0, Number(e.target.value) || 30))} />
          </div>
        </div>

        {testResult && (
          <div className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
            testResult.ok
              ? 'bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-900 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400',
          )}>
            {testResult.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
            <span>{testResult.msg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={testConnection} disabled={testing || !cfg.sftpHost}>
            {testing ? 'Probando…' : 'Probar conexión'}
          </Button>
          <Button onClick={save} disabled={saving} className="bg-green-700 hover:bg-green-800">
            <Save size={13} className="mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const METODOS_FIRMA_RECIBO: Record<string, string> = {
  CONTRASENA: 'Con contraseña del empleado',
  PROVEEDOR:  'Con proveedor externo (API)',
}

function MetodoFirmaReciboCard() {
  const [tipoId, setTipoId] = useState<number | null>(null)
  const [metodoFirma, setMetodoFirma] = useState<string>('CONTRASENA')
  const [initial, setInitial] = useState<string>('CONTRASENA')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/tipos-documento')
      .then(r => r.ok ? r.json() : [])
      .then((tipos: Array<{ id: number; nombre: string; metodoFirma?: string }>) => {
        const recibo = tipos.find(t => t.nombre === 'Recibo de Sueldo')
        if (recibo) {
          setTipoId(recibo.id)
          const m = recibo.metodoFirma ?? 'CONTRASENA'
          setMetodoFirma(m)
          setInitial(m)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (tipoId == null) return
    setSaving(true)
    try {
      const r = await fetch(`/api/configuracion/tipos-documento/${tipoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodoFirma }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? `Error ${r.status} al guardar`)
        return
      }
      toast.success('Método de firma actualizado')
      setInitial(metodoFirma)
    } finally { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSignature size={17} /> Método de firma para recibos</CardTitle>
        <CardDescription className="mt-1">
          Cómo firman los empleados los recibos de sueldo. Si elegís proveedor externo, se usa la API configurada en <em>General → Proveedor de firma electrónica</em>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Select value={metodoFirma} onValueChange={v => v && setMetodoFirma(v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent side="bottom" alignItemWithTrigger={false}>
              {Object.entries(METODOS_FIRMA_RECIBO).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={saving || metodoFirma === initial}
            className="bg-green-700 hover:bg-green-800"
          >
            <Save size={13} className="mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
