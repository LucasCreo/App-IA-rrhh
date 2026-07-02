'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, MailCheck } from 'lucide-react'

export default function OlvidePasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-8">
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={13} /> Volver al login
        </Link>
        {sent ? (
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <MailCheck size={26} className="text-green-700 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Revisá tu email</h2>
            <p className="text-sm text-muted-foreground">
              Si la cuenta existe, en unos minutos vas a recibir un mail con instrucciones para restablecer la contraseña.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">Recuperar contraseña</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ingresá tu usuario o email y te enviamos un link para restablecer la contraseña.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Usuario o email</Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="legajo o usuario@empresa.com"
                  required
                  className="h-10"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-10 bg-green-700 hover:bg-green-800 text-white"
                disabled={loading}
              >
                {loading ? 'Enviando…' : 'Enviar link'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
