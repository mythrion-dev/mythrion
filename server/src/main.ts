import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module.js'
import { getAllowedOrigins } from './config/allowed-origins.js'

export async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    // Allow every configured frontend origin (ALLOWED_ORIGINS + FRONTEND_URL + localhost).
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  app.use(cookieParser())

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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