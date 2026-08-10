jest.mock('pg', () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }))
jest.mock('./generated/prisma/client', () =>
  // Proxy so any imported enum (e.g. BookVisibility, MemberRole) used by
  // decorators such as @IsEnum resolves to an object instead of undefined.
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

import { Test } from '@nestjs/testing'
import { AppModule } from './app.module.js'
import { JwtAuthGuard } from './auth/jwt-auth.guard.js'
import { BookController } from './book/book.controller.js'
import { CharacterSheetController } from './character-sheet/character-sheet.controller.js'

describe('AppModule DI graph', () => {
  const OLD_ENV = {
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  }

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback'
  })

  afterAll(() => {
    for (const [key, value] of Object.entries(OLD_ENV)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  // Regression guard for the production boot failure where JwtAuthGuard
  // (JwtService, I18nService, Reflector, AuthService) could not resolve
  // AuthService inside modules that use the guard but don't import AuthModule.
  // compile() throws UnknownDependenciesException if the graph is broken.
  it('compiles the production module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    expect(moduleRef.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard)
    expect(() => moduleRef.get(BookController)).not.toThrow()
    expect(() => moduleRef.get(CharacterSheetController)).not.toThrow()
  })
})
