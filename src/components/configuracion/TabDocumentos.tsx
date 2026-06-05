'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'

interface Tipo { id: number; nombre: string; descripcion?: string | null }

export function TabDocumentos() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [editing, setEditing] = useState<Tipo | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTipo, setNewTipo] = useState({ nombre: '', descripcion: '' })

  async function load() {
    const r = await fetch('/api/configuracion/tipos-documento')
    setTipos(await r.json())
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newTipo.nombre.trim()) return
    await fetch('/api/configuracion/tipos-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTipo),
    })
    setNewTipo({ nombre: '', descripcion: '' })
    setAdding(false)
    load()
  }

  async function handleUpdate() {
    if (!editing) return
    await fetch(`/api/configuracion/tipos-documento/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setEditing(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar tipo? Los documentos asociados quedarán sin tipo.')) return
    await fetch(`/api/configuracion/tipos-documento/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Documento</CardTitle>
        <CardDescription>Categorías para clasificar los recibos al subirlos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-left px-4 py-2 font-medium">Descripción</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {tipos.length === 0 && !adding && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Sin tipos definidos</td></tr>
              )}
              {tipos.map(tipo => (
                <tr key={tipo.id} className="border-t">
                  {editing?.id === tipo.id ? (
                    <>
                      <td className="px-3 py-1.5">
                        <Input value={editing.nombre} onChange={e => setEditing(t => t ? { ...t, nombre: e.target.value } : t)} className="h-7 text-sm" />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input value={editing.descripcion ?? ''} onChange={e => setEditing(t => t ? { ...t, descripcion: e.target.value } : t)} className="h-7 text-sm" />
                      </td>
                      <td className="px-3 py-1.5 text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={handleUpdate}><Check size={13} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X size={13} /></Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium">{tipo.nombre}</td>
                      <td className="px-4 py-2 text-muted-foreground">{tipo.descripcion ?? '—'}</td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(tipo)}><Pencil size={13} /></Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(tipo.id)}><Trash2 size={13} /></Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {adding && (
                <tr className="border-t bg-green-50">
                  <td className="px-3 py-1.5">
                    <Input value={newTipo.nombre} onChange={e => setNewTipo(t => ({ ...t, nombre: e.target.value }))} placeholder="Nombre del tipo" className="h-7 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input value={newTipo.descripcion} onChange={e => setNewTipo(t => ({ ...t, descripcion: e.target.value }))} placeholder="Descripción (opcional)" className="h-7 text-sm" />
                  </td>
                  <td className="px-3 py-1.5 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={handleAdd}><Check size={13} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X size={13} /></Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Button variant="outline" className="border-green-700 text-green-700 hover:bg-green-50" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={15} className="mr-1" /> Nuevo Tipo
        </Button>
      </CardContent>
    </Card>
  )
}
