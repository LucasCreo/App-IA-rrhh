'use client'

import { ResponsivePie } from '@nivo/pie'
import { useTheme } from '@/components/providers/ThemeProvider'

const CAT_COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#d97706']

interface Props {
  documentosPorEstado: Array<{ name: string; value: number; color: string }>
  empleadosPorCategoria: Array<{ nombre: string; cantidad: number }>
}

const lightTooltip = {
  container: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 12px', fontSize: '12px', color: '#111827',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
}
const darkTooltip = {
  container: {
    background: '#1f2937', border: '1px solid #374151', borderRadius: '8px',
    padding: '8px 12px', fontSize: '12px', color: '#f9fafb',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
  },
}

function Legend({ items }: { items: Array<{ label: string; color: string; value: number }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
          <span className="font-medium text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Charts({ documentosPorEstado, empleadosPorCategoria }: Props) {
  const { theme } = useTheme()
  const tooltip = theme === 'dark' ? darkTooltip : lightTooltip

  const pieData = documentosPorEstado
    .filter(d => d.value > 0)
    .map(d => ({ id: d.name, label: d.name, value: d.value, color: d.color }))

  const catPieData = empleadosPorCategoria.map((e, i) => ({
    id: e.nombre, label: e.nombre, value: e.cantidad,
    color: CAT_COLORS[i % CAT_COLORS.length],
  }))

  const totalDocs = documentosPorEstado.reduce((s, d) => s + d.value, 0)
  const totalEmps = catPieData.reduce((s, d) => s + d.value, 0)

  const pieConfig = {
    innerRadius: 0,
    padAngle: 0,
    cornerRadius: 0,
    activeOuterRadiusOffset: 6,
    enableArcLabels: false,
    enableArcLinkLabels: false,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    theme: { tooltip },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <div className="bg-card rounded-xl border border-border p-5">
        <p className="font-semibold text-foreground">Estado de Documentos</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{totalDocs} documentos en total</p>
        {pieData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsivePie
                data={pieData}
                colors={{ datum: 'data.color' }}
                {...pieConfig}
              />
            </div>
            <Legend items={pieData.map(d => ({ label: d.label, color: d.color, value: d.value }))} />
          </>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <p className="font-semibold text-foreground">Empleados por Categoría</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{totalEmps} empleados en total</p>
        {catPieData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsivePie
                data={catPieData}
                colors={{ datum: 'data.color' }}
                {...pieConfig}
              />
            </div>
            <Legend items={catPieData.map(d => ({ label: d.label, color: d.color, value: d.value }))} />
          </>
        )}
      </div>
    </div>
  )
}
