import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export type Identity =
  | { type: 'guest'; sub: string }
  | { type: 'user'; sub: string; playerId: string; email: string }

export async function signToken(payload: Identity): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<Identity | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as Identity
  } catch {
    return null
  }
}

export function generateGuestIdentity(): Identity {
  return { type: 'guest', sub: nanoid() }
}
