import { describe, it, expect } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

/**
 * The proxy middleware only reads three things off the request:
 *   - request.nextUrl.pathname
 *   - request.url
 *   - request.cookies.get('auth_token')?.value
 *
 * We build minimal request-shaped objects (cast to NextRequest) so every
 * branch is reachable deterministically in jsdom. Note: because the
 * publicPaths whitelist contains '/', every real URL pathname matches the
 * first branch, so the redirect/static-asset branches can only be reached
 * with a synthetic non-'/' pathname.
 */
function makeRequest(pathname: string, tokenValue?: string | null) {
  const url = `http://localhost${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  return {
    nextUrl: { pathname },
    url,
    cookies: {
      get: (name: string) =>
        name === 'auth_token' && tokenValue !== undefined
          ? { value: tokenValue }
          : undefined,
    },
  } as unknown as NextRequest
}

describe('proxy', () => {
  it.each([
    '/',
    '/login',
    '/register',
    '/invite',
    '/auth',
    '/onboarding',
    '/verify-email',
  ])('allows public path %s', async (path) => {
    const res = await proxy(makeRequest(path))
    expect(res).toBeInstanceOf(NextResponse)
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows sub-paths under a public whitelist entry', async () => {
    const res = await proxy(makeRequest('/login/forgot-password'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // The '/' entry in publicPaths makes every leading-slash pathname public,
  // so real protected routes like /dashboard pass through too.
  it('passes through an authenticated protected route (real pathname)', async () => {
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through protected routes even without a token because "/" is whitelisted', async () => {
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows _next and favicon.ico real static paths (short-circuits on "/")', async () => {
    for (const path of [
      '/_next/static/chunks/app/layout.js',
      '/favicon.ico',
      '/images/logo.svg',
      '/fonts/font.woff2',
    ]) {
      const res = await proxy(makeRequest(path))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    }
  })

  it('allows static assets via the extension regex', async () => {
    for (const path of [
      'logo.svg',
      'image.png',
      'photo.jpeg',
      'font.woff2',
      'font.woff',
      'file.ttf',
      'file.eot',
      'file.gif',
      'icon.ico',
      'pic.jpg',
    ]) {
      const res = await proxy(makeRequest(path))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    }
  })

  it('redirects paths that are not public and not static assets (no token)', async () => {
    for (const path of ['logo.txt', 'dashboard', 'noext']) {
      const res = await proxy(makeRequest(path))
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/login')
    }
  })

  it('redirects unauthenticated protected requests to /login with the redirect param preserved', async () => {
    const res = await proxy(makeRequest('dashboard'))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.origin + location.pathname).toBe('http://localhost/login')
    expect(location.searchParams.get('redirect')).toBe('dashboard')
  })

  it('redirects with the full pathname as the redirect param', async () => {
    const res = await proxy(makeRequest('dashboard/settings'))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.searchParams.get('redirect')).toBe('dashboard/settings')
  })

  it('passes through when a non-empty auth_token cookie is present', async () => {
    const res = await proxy(makeRequest('dashboard', 'abc123'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects when the auth_token cookie has an empty value', async () => {
    const res = await proxy(makeRequest('dashboard', ''))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects when the auth_token cookie is missing entirely', async () => {
    const res = await proxy(makeRequest('dashboard', undefined))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
