'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Save, GripVertical } from 'lucide-react'
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
            <p className="text-xs font-medium text-muted-foreground">Patrones</p>
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
    </div>
  )
}
