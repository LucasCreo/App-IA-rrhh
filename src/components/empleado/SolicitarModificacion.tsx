'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export function SolicitarModificacion() {
  const [open, setOpen] = useState(false)
  const [comentario, setComentario] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    if (!comentario.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/solicitudes-modificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario }),
      })
      if (!res.ok) { toast.error('Error al enviar la solicitud'); return }
      toast.success('Solicitud enviada. El área de RRHH la revisará a la brevedad.')
      setComentario('')
      setOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">¿Hay datos incorrectos?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Podés solicitar una corrección al área de RRHH.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
          <Pencil size={13} className="mr-1.5" />
          Solicitar modificación
          {open ? <ChevronUp size={13} className="ml-1.5" /> : <ChevronDown size={13} className="ml-1.5" />}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <Textarea
            placeholder="Describí qué dato necesitás corregir y cuál es el valor correcto…"
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); setComentario('') }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800"
              disabled={!comentario.trim() || sending}
              onClick={handleSubmit}
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
