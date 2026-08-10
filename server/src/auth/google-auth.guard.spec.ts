import { GoogleAuthGuard } from './google-auth.guard.js'

describe('GoogleAuthGuard', () => {
  const makeContext = (query: Record<string, unknown> = {}) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ query }) }),
    }) as any

  it('is instantiable without injected AuthModuleOptions (param is @Optional)', () => {
    const guard = new GoogleAuthGuard()
    expect(guard).toBeInstanceOf(GoogleAuthGuard)
  })

  it('returns { state } when the requested origin is allowed', async () => {
    const guard = new GoogleAuthGuard()
    const options = await guard.getAuthenticateOptions(
      makeContext({ state: 'http://localhost:3000' }),
    )
    expect(options).toEqual({ state: 'http://localhost:3000' })
  })

  it('returns { state } for an allowed origin with a trailing slash (normalized)', async () => {
    const guard = new GoogleAuthGuard()
    const options = await guard.getAuthenticateOptions(
      makeContext({ state: 'http://localhost:3000/' }),
    )
    expect(options).toEqual({ state: 'http://localhost:3000/' })
  })

  it('returns {} when the requested origin is not allowed', async () => {
    const guard = new GoogleAuthGuard()
    const options = await guard.getAuthenticateOptions(
      makeContext({ state: 'http://evil.example' }),
    )
    expect(options).toEqual({})
  })

  it('returns {} when no state is present', async () => {
    const guard = new GoogleAuthGuard()
    const options = await guard.getAuthenticateOptions(makeContext())
    expect(options).toEqual({})
  })

  it('returns {} when state is present but query is undefined on the request', async () => {
    const guard = new GoogleAuthGuard()
    const context = { switchToHttp: () => ({ getRequest: () => ({}) }) } as any
    const options = await guard.getAuthenticateOptions(context)
    expect(options).toEqual({})
  })
})
