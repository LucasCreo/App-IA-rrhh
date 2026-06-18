'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { KeyRound } from 'lucide-react'
import { CambiarPasswordDialog } from '@/components/shared/CambiarPasswordDialog'

export function CambiarPasswordButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
        <KeyRound size={14} className="mr-1.5" /> Cambiar contraseña
      </Button>
      <CambiarPasswordDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
