import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { I18nService } from 'nestjs-i18n'
import { AppModule } from './app.module.js'
import { getAllowedOrigins, isAllowedOrigin } from './config/allowed-origins.js'
import { createI18nValidationExceptionFactory } from './i18n/validation-exception-factory.js'
import type { NextFunction, Request, Response } from 'express'

export async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    // Allow every configured frontend origin (ALLOWED_ORIGINS + FRONTEND_URL + localhost).
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  })

  app.use(cookieParser())

  // CSRF defense-in-depth: the API is bearer-token based (no cookies), but a
  // cross-origin attacker could still try to drive a state-changing request.
  // Reject any non-safe method whose Origin header is missing the allowlist.
  // GET/HEAD/OPTIONS are safe and skipped; non-browser clients (curl, server
  // to server) usually send no Origin and pass through via the missing-origin
  // branch.
  const i18n = app.get(I18nService)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next()
    }
    if (!req.headers.origin || isAllowedOrigin(req.headers.origin)) {
      return next()
    }
    const lang =
      String(req.headers['accept-language']?.split(',')[0]?.trim() ?? 'en')
    res.status(403).json({
      statusCode: 403,
      message: i18n.t('auth.csrfOriginRejected', { lang }),
      error: 'Forbidden',
    })
  })

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createI18nValidationExceptionFactory(),
    }),
  )

  await app.listen(process.env.PORT ?? 3000)
}

// Auto-bootstrap if running directly (for local dev)
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to bootstrap:', err)
    process.exit(1)
  })
}