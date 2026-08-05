import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CalendarioView } from '@/components/calendario/CalendarioView'

export default async function CalendarioAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const empleadosRaw = await prisma.employee.findMany({
    where: { estado: 'ACTIVO' },
    select: {
      id: true, nombre: true, apellido: true, legajo: true,
      categoria: { select: { id: true, nombre: true } },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  const empleados = empleadosRaw.map(e => ({
    id: e.id,
    nombre: e.nombre,
    apellido: e.apellido,
    legajo: e.legajo,
    categoriaId: e.categoria?.id ?? null,
    categoriaNombre: e.categoria?.nombre ?? null,
  }))

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Calendario</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <CalendarioView
          isAdmin
          empleados={empleados}
          currentUserId={user.userId}
        />
      </div>
    </div>
  )
}
