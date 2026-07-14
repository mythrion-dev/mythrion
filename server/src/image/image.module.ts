import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ImageController } from './image.controller.js'
import { ImageService } from './image.service.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ImageController],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
