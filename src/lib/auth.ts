import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import type { Permiso } from './permissions'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
export const COOKIE_NAME = 'rrhh_token'

export interface TokenPayload {
  userId: number
  role: 'ADMIN' | 'EMPLOYEE'
  employeeId?: number
  email: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as TokenPayload
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10)
export const comparePassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

// Returns user if ADMIN and has the given permission (o sin permisos custom = acceso total).
// Pass no permiso to just check that the user is an admin.
export async function requirePermiso(permiso?: Permiso) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  if (!permiso) return user

  const count = await prisma.userPermiso.count({ where: { userId: user.userId } })
  if (count === 0) return user // sin permisos custom = acceso total

  const has = await prisma.userPermiso.findUnique({
    where: { userId_permiso: { userId: user.userId, permiso } },
  })
  return has ? user : null
}
