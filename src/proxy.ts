import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'rrhh_token'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE)?.value

  if (pathname === '/login') {
    if (!token) return NextResponse.next()
    try {
      const { payload } = await jwtVerify(token, secret)
      const dest = payload.role === 'ADMIN' ? '/admin' : '/empleado'
      return NextResponse.redirect(new URL(dest, req.url))
    } catch {
      return NextResponse.next()
    }
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret)
    if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/empleado', req.url))
    }
    if (pathname.startsWith('/empleado') && payload.role !== 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(COOKIE)
    return res
  }
}

export const config = {
  matcher: ['/admin/:path*', '/empleado/:path*', '/login'],
}
