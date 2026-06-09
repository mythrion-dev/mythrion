import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'https://mythrion-olive.vercel.app',
      'http://localhost:3001',
    ],
    credentials: true,
  })

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
bootstrap()