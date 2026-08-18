jest.mock('pg', () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }))
jest.mock('./generated/prisma/client', () =>
  // Proxy so any imported enum used by decorators resolves to an object.
  new Proxy(
    { PrismaClient: class {} },
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        return {}
      },
    },
  ),
)
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))

// Replace only NestFactory.create; keep the rest of @nestjs/core intact so the
// AppModule dependency graph (Reflector, guards, etc.) still loads.
jest.mock('@nestjs/core', () => {
  const actual = jest.requireActual('@nestjs/core')
  return { ...actual, NestFactory: { create: jest.fn() } }
})

jest.mock('cookie-parser', () => jest.fn(() => 'COOKIE_PARSER_MIDDLEWARE'))

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { bootstrap } from './main.js'
import { AppModule } from './app.module.js'
import { createI18nServiceMock } from './i18n/i18n-testing.js'

const createMockApp = () => ({
  enableCors: jest.fn(),
  use: jest.fn(),
  get: jest.fn(),
  setGlobalPrefix: jest.fn(),
  useGlobalPipes: jest.fn(),
  listen: jest.fn().mockResolvedValue(undefined),
})

describe('bootstrap', () => {
  let app: ReturnType<typeof createMockApp>

  beforeEach(() => {
    app = createMockApp()
    app.get.mockReturnValue(createI18nServiceMock())
    ;(NestFactory.create as jest.Mock).mockResolvedValue(app)
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.PORT
  })

  it('creates the app from AppModule', async () => {
    await bootstrap()
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule)
  })

  it('enables CORS with credentials and the configured methods/headers', async () => {
    await bootstrap()
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
      }),
    )
  })

  it('uses the cookie-parser middleware', async () => {
    await bootstrap()
    expect(app.use).toHaveBeenCalledWith('COOKIE_PARSER_MIDDLEWARE')
  })

  it('sets the global API prefix excluding health', async () => {
    await bootstrap()
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api', {
      exclude: ['health'],
    })
  })

  it('registers a ValidationPipe with whitelist, forbidNonWhitelisted, transform and an i18n exceptionFactory', async () => {
    await bootstrap()
    const pipe = app.useGlobalPipes.mock.calls[0][0]
    expect(pipe).toBeInstanceOf(ValidationPipe)
    expect(pipe.validatorOptions.whitelist).toBe(true)
    expect(pipe.validatorOptions.forbidNonWhitelisted).toBe(true)
    expect(pipe.isTransformEnabled).toBe(true)
    expect(typeof pipe.exceptionFactory).toBe('function')
  })

  it('listens on process.env.PORT when set', async () => {
    process.env.PORT = '8080'
    await bootstrap()
    expect(app.listen).toHaveBeenCalledWith('8080')
  })

  it('listens on port 3000 by default', async () => {
    await bootstrap()
    expect(app.listen).toHaveBeenCalledWith(3000)
  })

  describe('CSRF middleware', () => {
    const getCsrfMiddleware = () => {
      const middlewares = app.use.mock.calls.map((c) => c[0])
      const csrf = middlewares.find((fn) => fn !== 'COOKIE_PARSER_MIDDLEWARE')
      if (!csrf) throw new Error('CSRF middleware not registered')
      return csrf as (req: any, res: any, next: any) => void
    }

    const makeRes = () => {
      const res = { status: jest.fn(), json: jest.fn() }
      res.status.mockReturnValue(res)
      return res
    }

    it('lets safe methods (GET, HEAD, OPTIONS) pass through', async () => {
      await bootstrap()
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const next = jest.fn()
        getCsrfMiddleware()({ method, headers: {} }, makeRes(), next)
        expect(next).toHaveBeenCalledTimes(1)
      }
    })

    it('lets non-safe requests without an Origin pass through', async () => {
      await bootstrap()
      const next = jest.fn()
      getCsrfMiddleware()({ method: 'POST', headers: {} }, makeRes(), next)
      expect(next).toHaveBeenCalledTimes(1)
    })

    it('lets non-safe requests with an allowed Origin pass through', async () => {
      await bootstrap()
      const next = jest.fn()
      getCsrfMiddleware()(
        { method: 'POST', headers: { origin: 'http://localhost:3000' } },
        makeRes(),
        next,
      )
      expect(next).toHaveBeenCalledTimes(1)
    })

    it('rejects a non-safe request with a disallowed Origin with 403', async () => {
      await bootstrap()
      const next = jest.fn()
      const res = makeRes()
      getCsrfMiddleware()(
        { method: 'POST', headers: { origin: 'http://evil.example' } },
        res,
        next,
      )
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'Request origin not allowed.',
        error: 'Forbidden',
      })
    })

    it('derives lang from accept-language when rejecting', async () => {
      await bootstrap()
      const res = makeRes()
      getCsrfMiddleware()(
        {
          method: 'PUT',
          headers: {
            origin: 'http://evil.example',
            'accept-language': 'pt-BR,pt;q=0.9',
          },
        },
        res,
        jest.fn(),
      )
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json.mock.calls[0][0].message).toBe('Request origin not allowed.')
    })
  })
})
