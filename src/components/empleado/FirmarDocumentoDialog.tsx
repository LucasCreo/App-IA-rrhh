'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const TIEMPO_MIN_SEG_DEFAULT = 10

interface Props {
  open: boolean
  docId: number | null
  titulo: string
  descripcion: string
  onClose: () => void
  onFirmado: () => void
}

export function FirmarDocumentoDialog({ open, docId, titulo, descripcion, onClose, onFirmado }: Props) {
  const [password, setPassword] = useState('')
  const [conforme, setConforme] = useState<'si' | 'no' | ''>('')
  const [comentario, setComentario] = useState('')
  const [firmando, setFirmando] = useState(false)
  const [tiempoMinSeg, setTiempoMinSeg] = useState(TIEMPO_MIN_SEG_DEFAULT)
  const [segundosRestantes, setSegundosRestantes] = useState(TIEMPO_MIN_SEG_DEFAULT)
  const [pasoFirma, setPasoFirma] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConforme('')
    setComentario('')
    setPasoFirma(false)
    setSegundosRestantes(tiempoMinSeg)
    fetch('/api/configuracion/general').then(r => r.ok ? r.json() : null).then(cfg => {
      if (cfg && typeof cfg.firmaMinSec === 'number' && cfg.firmaMinSec >= 0) {
        setTiempoMinSeg(cfg.firmaMinSec)
        setSegundosRestantes(cfg.firmaMinSec)
      }
    }).catch(() => {})
    intervalRef.current = setInterval(() => {
      setSegundosRestantes(s => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [open])

  async function confirmar() {
    if (!docId) return
    if (!conforme) { toast.error('Indicá si estás conforme'); return }
    if (!password) { toast.error('Ingresá tu contraseña'); return }
    setFirmando(true)
    const res = await fetch(`/api/documentos/${docId}/firmar-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, conforme: conforme === 'si', comentario }),
    })
    setFirmando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'No se pudo firmar')
      return
    }
    toast.success('Documento firmado')
    onFirmado()
    onClose()
  }

  const puedeContinuar = segundosRestantes === 0

  return (
    <>
      <Dialog open={open && !pasoFirma} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[95vh] p-0 gap-0 grid-rows-[auto_1fr_auto]">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>{titulo}</DialogTitle>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          </DialogHeader>

          {docId && (
            <iframe
              src={`/api/documentos/${docId}/archivo#toolbar=1&view=FitH`}
              className="w-full h-[75vh] bg-muted"
              title="Documento"
            />
          )}

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-muted/40">
            <p className="text-xs text-muted-foreground">
              {puedeContinuar
                ? 'Cuando estés listo, presioná Continuar para firmar.'
                : `Leé el documento. Podés continuar en ${segundosRestantes}s.`}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={() => setPasoFirma(true)}
                disabled={!puedeContinuar}
              >
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open && pasoFirma} onOpenChange={o => { if (!o) { setPasoFirma(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar firma</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Vas a firmar <strong>{descripcion}</strong>.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5">¿Estás conforme con el documento?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConforme('si')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    conforme === 'si'
                      ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  Conforme
                </button>
                <button
                  type="button"
                  onClick={() => setConforme('no')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    conforme === 'no'
                      ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  No conforme
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Comentario {conforme === 'no' && <span className="text-muted-foreground text-xs">(recomendado)</span>}</Label>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={3}
                placeholder="Opcional…"
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <Label className="mb-1.5">Contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && conforme) confirmar() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasoFirma(false)} disabled={firmando}>Volver</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={confirmar}
              disabled={firmando || !password || !conforme}
            >
              {firmando ? 'Firmando…' : 'Firmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
