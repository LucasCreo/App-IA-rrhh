import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MisRecibos } from '@/components/empleado/MisRecibos'

export default async function EmpleadoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const employee = await prisma.employee.findUnique({
    where: { id: decoded.employeeId },
    include: { categoria: true },
  })
  if (!employee) redirect('/login')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-green-900">
            {employee.apellido}, {employee.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Legajo', employee.legajo],
              ['CUIL', employee.cuil],
              ['Email', employee.email],
              ['Categoría', employee.categoria.nombre],
              ['Fecha de Ingreso', new Date(employee.fechaIngreso).toLocaleDateString('es-AR')],
              ['Estado', employee.estado],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-green-900">Mis Recibos de Sueldo</CardTitle>
        </CardHeader>
        <CardContent>
          <MisRecibos employeeId={decoded.employeeId} />
        </CardContent>
      </Card>
    </div>
  )
}
