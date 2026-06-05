'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const LABELS: Record<string, string> = {
  legajo: 'Legajo', cuil: 'CUIL', email: 'Email',
  telefono: 'Teléfono', fechaIngreso: 'Fecha de Ingreso',
  categoria: 'Categoría', estado: 'Estado',
}

interface FieldConfig { campo: string; visible: boolean; requerido: boolean }

export function TabEmpleados() {
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/empleados-campos').then(r => r.json()).then(setFields)
  }, [])

  function toggle(campo: string, key: 'visible' | 'requerido') {
    setFields(fs => fs.map(f => {
      if (f.campo !== campo) return f
      const updated = { ...f, [key]: !f[key] }
      if (key === 'visible' && !updated.visible) updated.requerido = false
      return updated
    }))
  }

  async function handleSave() {
    await fetch('/api/configuracion/empleados-campos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campos del módulo Empleados</CardTitle>
        <CardDescription>Configurá qué campos se muestran y cuáles son obligatorios en el formulario.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Campo</th>
                <th className="text-center px-4 py-2 font-medium">Visible</th>
                <th className="text-center px-4 py-2 font-medium">Requerido</th>
              </tr>
            </thead>
            <tbody>
              {(['nombre', 'apellido'] as const).map(f => (
                <tr key={f} className="border-t bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</td>
                  <td className="text-center px-4 py-2"><input type="checkbox" checked readOnly className="w-4 h-4 opacity-50" /></td>
                  <td className="text-center px-4 py-2"><input type="checkbox" checked readOnly className="w-4 h-4 opacity-50" /></td>
                </tr>
              ))}
              {fields.map(f => (
                <tr key={f.campo} className="border-t">
                  <td className="px-4 py-2 font-medium">{LABELS[f.campo] ?? f.campo}</td>
                  <td className="text-center px-4 py-2">
                    <input type="checkbox" checked={f.visible} onChange={() => toggle(f.campo, 'visible')} className="w-4 h-4 accent-green-700" />
                  </td>
                  <td className="text-center px-4 py-2">
                    <input type="checkbox" checked={f.requerido} onChange={() => toggle(f.campo, 'requerido')} disabled={!f.visible} className="w-4 h-4 accent-green-700 disabled:opacity-30" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Nombre y Apellido siempre son visibles y requeridos.</p>
        <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>
          {saved ? '✓ Guardado' : 'Guardar'}
        </Button>
      </CardContent>
    </Card>
  )
}
