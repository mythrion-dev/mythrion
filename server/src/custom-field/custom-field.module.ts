import { Module } from '@nestjs/common'
import { CustomFieldService } from './custom-field.service.js'
import { CustomFieldController } from './custom-field.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [CustomFieldController],
  providers: [CustomFieldService, PrismaService],
  exports: [CustomFieldService],
})
export class CustomFieldModule {}