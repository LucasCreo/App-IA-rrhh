'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CAT_COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#d97706']

interface Props {
  documentosPorEstado: Array<{ name: string; value: number; color: string }>
  empleadosPorCategoria: Array<{ nombre: string; cantidad: number }>
}

export function Charts({ documentosPorEstado, empleadosPorCategoria }: Props) {
  const catData = empleadosPorCategoria.map(e => ({ name: e.nombre, value: e.cantidad }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-green-900 mb-4">Estado de Documentos</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={documentosPorEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {documentosPorEstado.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-green-900 mb-4">Empleados por Categoría</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
              {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
