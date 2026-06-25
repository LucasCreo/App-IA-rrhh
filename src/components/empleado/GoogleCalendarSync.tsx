'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Unlink } from 'lucide-react'

interface Props {
  connected: boolean
  lastSync?: string | null
}

export function GoogleCalendarSync({ connected: initialConnected, lastSync: initialLastSync }: Props) {
  const [connected, setConnected] = useState(initialConnected)
  const [lastSync] = useState(initialLastSync)
  const router = useRouter()
  const searchParams = useSearchParams()

  const googleParam = searchParams.get('google')
  if (googleParam === 'ok' && !connected) setConnected(true)
  if (googleParam === 'error') toast.error('No se pudo conectar Google Calendar')

  async function handleDisconnect() {
    const res = await fetch('/api/auth/google/disconnect', { method: 'POST' })
    if (res.ok) {
      setConnected(false)
      toast.success('Google Calendar desconectado')
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0">
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <div>
          <p className="text-sm font-medium">Google Calendar</p>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {connected
              ? lastSync
                ? `Última sincronización: ${new Date(lastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Conectado — sincronizá para importar eventos'
              : 'Sincronizá tus eventos de Google Calendar'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={handleDisconnect}>
              <Unlink size={14} className="mr-1.5" />
              Desconectar
            </Button>
          </>
        ) : (
          <a href="/api/auth/google" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-green-700 hover:bg-green-800 text-white transition-colors">
            Conectar
          </a>
        )}
      </div>
    </div>
  )
}
