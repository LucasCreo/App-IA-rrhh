import { AdminHeader } from '@/components/layout/AdminHeader'
import { CategoriasTable } from '@/components/categorias/CategoriasTable'

export default function CategoriasPage() {
  return (
    <>
      <AdminHeader title="Categorías" />
      <div className="p-4 sm:p-6">
        <CategoriasTable />
      </div>
    </>
  )
}
