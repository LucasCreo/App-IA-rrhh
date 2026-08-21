import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const cats = await Promise.all([
    prisma.category.upsert({ where: { nombre: 'Administrativo' }, update: {}, create: { nombre: 'Administrativo' } }),
    prisma.category.upsert({ where: { nombre: 'Operario' }, update: {}, create: { nombre: 'Operario' } }),
    prisma.category.upsert({ where: { nombre: 'Supervisor' }, update: {}, create: { nombre: 'Supervisor' } }),
    prisma.category.upsert({ where: { nombre: 'Gerente' }, update: {}, create: { nombre: 'Gerente' } }),
  ])

  const areaGeneral = await prisma.area.upsert({
    where: { nombre: 'General' },
    update: {},
    create: { nombre: 'General' },
  })

  await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      email: 'admin@empresa.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  })

  const emp1 = await prisma.employee.upsert({
    where: { legajo: 'EMP001' },
    update: {},
    create: {
      legajo: 'EMP001',
      nombre: 'Juan',
      apellido: 'García',
      cuil: '20-12345678-9',
      email: 'juan.garcia@empresa.com',
      telefono: '011-4444-5555',
      fechaIngreso: new Date('2022-03-01'),
      areaId: areaGeneral.id,
      categoriaId: cats[0].id,
      estado: 'ACTIVO',
    },
  })

  await prisma.user.upsert({
    where: { email: 'juan.garcia@empresa.com' },
    update: {},
    create: {
      email: 'juan.garcia@empresa.com',
      passwordHash: await bcrypt.hash('empleado123', 10),
      role: 'EMPLOYEE',
      employeeId: emp1.id,
    },
  })

  const emp2 = await prisma.employee.upsert({
    where: { legajo: 'EMP002' },
    update: {},
    create: {
      legajo: 'EMP002',
      nombre: 'María',
      apellido: 'López',
      cuil: '27-98765432-1',
      email: 'maria.lopez@empresa.com',
      fechaIngreso: new Date('2021-06-15'),
      areaId: areaGeneral.id,
      categoriaId: cats[2].id,
      estado: 'ACTIVO',
    },
  })

  await prisma.user.upsert({
    where: { email: 'maria.lopez@empresa.com' },
    update: {},
    create: {
      email: 'maria.lopez@empresa.com',
      passwordHash: await bcrypt.hash('empleado123', 10),
      role: 'EMPLOYEE',
      employeeId: emp2.id,
    },
  })

  // Tipos de evento protegidos (AUSENCIA se removió: lo cubre el módulo Licencias)
  await prisma.tipoEvento.upsert({
    where: { nombre: 'FERIADO' },
    update: {},
    create: { nombre: 'FERIADO', color: '#dc2626', permiteAdmin: true, permiteEmpleado: false, protegido: true },
  })

  console.log('Seed completado.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
