import { AdminHeader } from '@/components/layout/AdminHeader'
import { TabSaldos } from '@/components/ausencias/AusenciasAdmin'

export default function LicenciasPage() {
  return (
    <>
      <AdminHeader title="Licencias" />
      <div className="p-4 sm:p-6">
        <TabSaldos />
      </div>
    </>
  )
}
