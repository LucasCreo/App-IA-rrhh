import { AdminHeader } from '@/components/layout/AdminHeader'
import { EmpleadosTable } from '@/components/empleados/EmpleadosTable'

export default function EmpleadosPage() {
  return (
    <>
      <AdminHeader title="Empleados" />
      <div className="p-6">
        <EmpleadosTable />
      </div>
    </>
  )
}
