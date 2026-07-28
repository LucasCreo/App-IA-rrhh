'use client'

import { MisDocumentos } from './MisDocumentos'

interface Props { employeeId: number }

export function DocumentosEmpleadoTabs({ employeeId }: Props) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden p-4">
      <MisDocumentos employeeId={employeeId} />
    </div>
  )
}
