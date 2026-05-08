import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { signToken, verifyToken, generateGuestIdentity } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  // 1. Registered user: httpOnly cookie named 'token'
  const userCookie = request.cookies.get('token')?.value
  if (userCookie) {
    const identity = await verifyToken(userCookie)
    if (identity) {
      requestHeaders.set('x-identity', JSON.stringify(identity))
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // 2. Guest (or user from SPA): Authorization: Bearer header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const identity = await verifyToken(token)
    if (identity) {
      requestHeaders.set('x-identity', JSON.stringify(identity))
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // 3. Guest token from cookie (set by a previous visit)
  const guestCookie = request.cookies.get('guest-token')?.value
  if (guestCookie) {
    const identity = await verifyToken(guestCookie)
    if (identity) {
      requestHeaders.set('x-identity', JSON.stringify(identity))
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // 4. First visit: generate a guest identity and set it as a readable cookie
  const identity = generateGuestIdentity()
  const token = await signToken(identity)

  requestHeaders.set('x-identity', JSON.stringify(identity))
  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.cookies.set('guest-token', token, {
    httpOnly: false, // client JS needs to read this for localStorage + API calls
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
