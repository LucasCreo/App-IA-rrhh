'use client'

import { ResponsivePie } from '@nivo/pie'
import { useTheme } from '@/components/providers/ThemeProvider'

const CAT_COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#d97706']

interface Props {
  documentosPorEstado: Array<{ name: string; value: number; color: string }>
  empleadosPorCategoria: Array<{ nombre: string; cantidad: number }>
}

const lightTheme = {
  text: { fill: '#6b7280', fontSize: 11 },
  axis: { ticks: { text: { fill: '#6b7280', fontSize: 11 } } },
  grid: { line: { stroke: '#e5e7eb', strokeDasharray: '4 4' } },
  tooltip: {
    container: {
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
      color: '#111827',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
}

const darkTheme = {
  text: { fill: '#9ca3af', fontSize: 11 },
  axis: { ticks: { text: { fill: '#9ca3af', fontSize: 11 } } },
  grid: { line: { stroke: '#374151', strokeDasharray: '4 4' } },
  tooltip: {
    container: {
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
      color: '#f9fafb',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
    },
  },
}

export function Charts({ documentosPorEstado, empleadosPorCategoria }: Props) {
  const { theme } = useTheme()
  const nivoTheme = theme === 'dark' ? darkTheme : lightTheme

  const pieData = documentosPorEstado.map(d => ({
    id: d.name,
    label: d.name,
    value: d.value,
    color: d.color,
  }))

  const catPieData = empleadosPorCategoria.map((e, i) => ({
    id: e.nombre,
    label: e.nombre,
    value: e.cantidad,
    color: CAT_COLORS[i % CAT_COLORS.length],
  }))
  const totalDocs = documentosPorEstado.reduce((s, d) => s + d.value, 0)
  const totalEmps = catPieData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <div className="bg-card rounded-xl border border-border p-5">
        <p className="font-semibold text-foreground">Estado de Documentos</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{totalDocs} documentos en total</p>
        <div className="h-[240px]">
          <ResponsivePie
            data={pieData}
            colors={{ datum: 'data.color' }}
            innerRadius={0.6}
            padAngle={1.5}
            cornerRadius={4}
            activeOuterRadiusOffset={6}
            enableArcLabels={false}
            enableArcLinkLabels
            arcLinkLabelsSkipAngle={12}
            arcLinkLabelsTextColor={theme === 'dark' ? '#9ca3af' : '#374151'}
            arcLinkLabelsThickness={1.5}
            arcLinkLabelsColor={{ from: 'color' }}
            theme={nivoTheme}
            margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <p className="font-semibold text-foreground">Empleados por Categoría</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{totalEmps} empleados en total</p>
        <div className="h-[240px]">
          <ResponsivePie
            data={catPieData}
            colors={{ datum: 'data.color' }}
            innerRadius={0}
            padAngle={0}
            cornerRadius={0}
            activeOuterRadiusOffset={6}
            enableArcLabels={false}
            enableArcLinkLabels={false}
            theme={nivoTheme}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          />
        </div>
      </div>
    </div>
  )
}
