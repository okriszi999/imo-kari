import { createCookie } from 'remix/cookie'

const loginCookie = createCookie('imochristmas_login', {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  secrets: [process.env.SESSION_SECRET ?? 'imochristmas-local-session-secret'],
})

export async function readLoginEmail(request: Request): Promise<string | null> {
  let value: unknown = await loginCookie.parse(request.headers.get('Cookie'))
  return typeof value === 'string' ? value : null
}

export function createLoginCookie(email: string): Promise<string> {
  return loginCookie.serialize(email.trim().toLowerCase())
}
