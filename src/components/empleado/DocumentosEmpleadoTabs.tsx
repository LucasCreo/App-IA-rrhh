'use client'

import { MisDocumentos } from './MisDocumentos'

interface Props { employeeId: number }

export function DocumentosEmpleadoTabs({ employeeId }: Props) {
  return <MisDocumentos employeeId={employeeId} />
}
