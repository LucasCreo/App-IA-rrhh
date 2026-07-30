import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { MiLegajoTabs } from '@/components/empleado/MiLegajoTabs'

export default async function MiLegajoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const [employee, dbUser] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      include: {
        categoria: true,
        valoresCampos: { include: { campo: true } },
      },
    }),
    prisma.user.findUnique({
      where: { employeeId: decoded.employeeId },
      select: { avatarUrl: true, avatarBgColor: true, avatarTextColor: true },
    }),
  ])
  if (!employee) redirect('/login')

  const serializedEmployee = {
    nombre: employee.nombre,
    apellido: employee.apellido,
    legajo: employee.legajo,
    email: employee.email,
    telefono: employee.telefono,
    cuil: employee.cuil,
    estado: employee.estado,
    fechaIngreso: employee.fechaIngreso.toISOString(),
    categoria: { nombre: employee.categoria.nombre },
    valoresCampos: employee.valoresCampos.map(v => ({
      id: v.id,
      valor: v.valor,
      campo: { nombre: v.campo.nombre, tipo: v.campo.tipo, visible: v.campo.visible },
    })),
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Mi Legajo</h1>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <MiLegajoTabs
          employee={serializedEmployee}
          employeeId={decoded.employeeId}
          avatarUrl={dbUser?.avatarUrl ?? null}
          avatarBgColor={dbUser?.avatarBgColor ?? null}
          avatarTextColor={dbUser?.avatarTextColor ?? null}
        />
      </div>
    </div>
  )
}
