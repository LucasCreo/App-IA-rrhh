'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Send, RotateCcw, Save, Mail, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const GRUPOS: { id: string; label: string; keys: string[] }[] = [
  { id: 'cuenta',       label: 'Cuenta y usuarios', keys: ['EMPLEADO_BIENVENIDA', 'EMPLEADO_ESTADO_CAMBIADO', 'PASSWORD_RESET', 'EMAIL_CAMBIADO'] },
  { id: 'documentos',   label: 'Documentos',        keys: ['DOCUMENTO_A_FIRMA', 'RECIBO_FIRMADO'] },
  { id: 'solicitudes',  label: 'Solicitudes',       keys: ['SOLICITUD_NUEVA', 'SOLICITUD_DOC_RESUELTA', 'MODIFICACION_NUEVA', 'MODIFICACION_REVISADA'] },
  { id: 'ausencias',    label: 'Ausencias',         keys: ['AUSENCIA_NUEVA', 'AUSENCIA_RESUELTA'] },
  { id: 'formularios',  label: 'Formularios',       keys: ['FORMULARIO_ASIGNADO', 'FORMULARIO_COMPLETADO'] },
  { id: 'evaluaciones', label: 'Evaluaciones',      keys: ['EVALUACION_ASIGNADA'] },
  { id: 'avisos',       label: 'Avisos',            keys: ['POST_NUEVO', 'COMENTARIO_NUEVO_EN_POST', 'COMENTARIO_RESPONDIDO'] },
]

function grupoDeKey(key: string): string {
  return GRUPOS.find(g => g.keys.includes(key))?.id ?? 'otros'
}

interface Variable { name: string; description: string }
interface Template {
  key: string
  label: string
  description: string
  variables: Variable[]
  customized: boolean
  enabled: boolean
  subject: string
  title: string
  bodyHtml: string
  ctaLabel: string | null
  default: { subject: string; title: string; bodyHtml: string; ctaLabel: string | null }
}

export function TabEmails() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ subject: string; title: string; bodyHtml: string; ctaLabel: string; enabled: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())

  const selected = templates.find(t => t.key === selectedKey) ?? null

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/configuracion/email-templates')
      if (r.ok) setTemplates(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selected) { setDraft(null); return }
    setDraft({
      subject: selected.subject,
      title: selected.title,
      bodyHtml: selected.bodyHtml,
      ctaLabel: selected.ctaLabel ?? '',
      enabled: selected.enabled,
    })
  }, [selectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al seleccionar un template, abrir su grupo
  useEffect(() => {
    if (!selectedKey) return
    const gid = grupoDeKey(selectedKey)
    setGruposAbiertos(prev => prev.has(gid) ? prev : new Set([...prev, gid]))
  }, [selectedKey])

  function toggleGrupo(id: string) {
    setGruposAbiertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dirty = selected && draft && (
    draft.subject !== selected.subject
    || draft.title !== selected.title
    || draft.bodyHtml !== selected.bodyHtml
    || draft.ctaLabel !== (selected.ctaLabel ?? '')
    || draft.enabled !== selected.enabled
  )

  async function handleSave() {
    if (!selected || !draft) return
    setSaving(true)
    try {
      const r = await fetch(`/api/configuracion/email-templates/${selected.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: draft.subject,
          title: draft.title,
          bodyHtml: draft.bodyHtml,
          ctaLabel: draft.ctaLabel || null,
          enabled: draft.enabled,
        }),
      })
      if (!r.ok) { toast.error('Error al guardar'); return }
      toast.success('Template guardado')
      await load()
    } finally { setSaving(false) }
  }

  async function handleReset() {
    if (!selected) return
    setResetting(true)
    try {
      const r = await fetch(`/api/configuracion/email-templates/${selected.key}`, { method: 'DELETE' })
      if (!r.ok) { toast.error('Error al restaurar'); return }
      toast.success('Restaurado al texto original')
      setResetOpen(false)
      await load()
    } finally { setResetting(false) }
  }

  async function handleTest() {
    if (!selected) return
    if (dirty) {
      toast.error('Guardá los cambios antes de mandar la prueba')
      return
    }
    setTesting(true)
    try {
      const r = await fetch(`/api/configuracion/email-templates/${selected.key}/test`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error ?? 'Error al enviar'); return }
      toast.success(`Prueba enviada a ${data.sentTo}`)
    } finally { setTesting(false) }
  }

  function insertVariable(varName: string, into: 'subject' | 'title' | 'bodyHtml') {
    if (!draft) return
    const placeholder = `{{${varName}}}`
    setDraft(d => d ? { ...d, [into]: (d[into] || '') + placeholder } : d)
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Lista de templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Notificaciones</CardTitle>
          <CardDescription className="text-xs">Elegí una para editarla.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {GRUPOS.map(g => {
              const items = templates.filter(t => g.keys.includes(t.key))
              if (items.length === 0) return null
              const abierto = gruposAbiertos.has(g.id)
              const customCount = items.filter(t => t.customized).length
              return (
                <div key={g.id}>
                  <button
                    onClick={() => toggleGrupo(g.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-muted/50 transition-colors"
                  >
                    {abierto
                      ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">{g.label}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {items.length}{customCount > 0 && ` · ${customCount} editado${customCount === 1 ? '' : 's'}`}
                    </span>
                  </button>
                  {abierto && (
                    <div className="divide-y border-t bg-muted/20">
                      {items.map(t => {
                        const active = t.key === selectedKey
                        return (
                          <button
                            key={t.key}
                            onClick={() => setSelectedKey(t.key)}
                            className={cn(
                              'w-full text-left pl-8 pr-4 py-2.5 flex items-center gap-2 hover:bg-muted transition-colors',
                              active && 'bg-green-50 dark:bg-green-950/20'
                            )}
                          >
                            <Mail size={13} className={cn('shrink-0', active ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn('text-sm truncate', active && 'font-medium text-green-700 dark:text-green-400')}>{t.label}</p>
                                {t.customized && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold" title="Editado">•</span>
                                )}
                                {!t.enabled && (
                                  <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">off</span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {(() => {
              const sinGrupo = templates.filter(t => !GRUPOS.some(g => g.keys.includes(t.key)))
              if (sinGrupo.length === 0) return null
              return (
                <div className="py-2 px-4">
                  <p className="text-xs text-muted-foreground mb-1">Otros</p>
                  {sinGrupo.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedKey(t.key)}
                      className={cn(
                        'w-full text-left py-1.5 text-sm hover:underline',
                        t.key === selectedKey && 'text-green-700 dark:text-green-400 font-medium'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {!selected || !draft ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Seleccioná una notificación para editarla.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{selected.label}</CardTitle>
                  <CardDescription className="mt-1">{selected.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enabled"
                    checked={draft.enabled}
                    onCheckedChange={v => setDraft(d => d ? { ...d, enabled: v === true } : d)}
                  />
                  <Label htmlFor="enabled" className="text-xs cursor-pointer">
                    {draft.enabled ? 'Activo' : 'Desactivado'}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.variables.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Variables disponibles (click para insertar en el cuerpo)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.variables.map(v => (
                      <button
                        key={v.name}
                        onClick={() => insertVariable(v.name, 'bodyHtml')}
                        title={v.description}
                        className="text-xs px-2 py-1 rounded border bg-muted hover:bg-green-100 hover:border-green-500 dark:hover:bg-green-950/40 transition-colors font-mono"
                      >
                        {`{{${v.name}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-1.5">Asunto</Label>
                <Input
                  value={draft.subject}
                  onChange={e => setDraft(d => d ? { ...d, subject: e.target.value } : d)}
                />
              </div>

              <div>
                <Label className="mb-1.5">Título (encabezado dentro del mail)</Label>
                <Input
                  value={draft.title}
                  onChange={e => setDraft(d => d ? { ...d, title: e.target.value } : d)}
                />
              </div>

              <div>
                <Label className="mb-1.5">Cuerpo (HTML)</Label>
                <textarea
                  value={draft.bodyHtml}
                  onChange={e => setDraft(d => d ? { ...d, bodyHtml: e.target.value } : d)}
                  rows={12}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-500/50"
                />
              </div>

              <div>
                <Label className="mb-1.5">Texto del botón <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  value={draft.ctaLabel}
                  onChange={e => setDraft(d => d ? { ...d, ctaLabel: e.target.value } : d)}
                  placeholder="Ej: Ver en el portal"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="bg-green-700 hover:bg-green-800"
                  >
                    <Save size={14} className="mr-1.5" />
                    {saving ? 'Guardando…' : 'Guardar'}
                  </Button>
                  <Button variant="outline" onClick={handleTest} disabled={testing || !!dirty}>
                    <Send size={14} className="mr-1.5" />
                    {testing ? 'Enviando…' : 'Enviarme una prueba'}
                  </Button>
                </div>
                {selected.customized && (
                  <Button variant="outline" onClick={() => setResetOpen(true)} className="text-red-600 hover:text-red-700">
                    <RotateCcw size={14} className="mr-1.5" />
                    Restaurar original
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Vista previa</CardTitle>
              <CardDescription className="text-xs">
                Se muestra tal cual, con las variables sin reemplazar. Para ver con datos reales, mandate una prueba.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Asunto:</p>
                <p className="text-sm font-medium mb-3">{draft.subject}</p>
                <div className="bg-white dark:bg-neutral-900 rounded-md p-6 border">
                  <h2 className="text-lg font-bold text-green-700 dark:text-green-400 mb-3">{draft.title}</h2>
                  <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: draft.bodyHtml }} />
                  {draft.ctaLabel && (
                    <div className="my-4 text-center">
                      <span className="inline-block bg-green-700 text-white px-4 py-2 rounded font-semibold text-sm">
                        {draft.ctaLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={resetOpen} onOpenChange={o => !o && !resetting && setResetOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar el texto original?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a perder los cambios personalizados de esta notificación y volverá al texto por defecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
