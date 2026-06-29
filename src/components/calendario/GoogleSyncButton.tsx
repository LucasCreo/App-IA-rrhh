'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  lastSync?: string | null
}

export function GoogleSyncButton({ lastSync: initialLastSync }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(initialLastSync)
  const router = useRouter()

  async function handleSync() {
    setSyncing(true)
    const res = await fetch('/api/calendario/google/sync', { method: 'POST' })
    setSyncing(false)
    if (res.ok) {
      const data = await res.json()
      setLastSync(data.syncedAt)
      const partes = [`${data.synced} importados`]
      if (data.pushed) partes.push(`${data.pushed} enviados`)
      toast.success(`Sincronizado — ${partes.join(', ')}`)
      router.refresh()
    } else {
      toast.error('Error al sincronizar')
    }
  }

  if (lastSync) {
    return (
      <button
        onClick={handleSync}
        disabled={syncing}
        className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-60"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin text-green-600' : 'text-green-600'} />
        <span suppressHydrationWarning>
          {syncing ? 'Sincronizando…' : `Sincronizado con Google · ${new Date(lastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </button>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
      <RefreshCw size={14} className={`mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Sincronizando...' : 'Sincronizar Google'}
    </Button>
  )
}
