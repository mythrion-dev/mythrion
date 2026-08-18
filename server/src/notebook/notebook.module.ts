import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { NotebookController } from './notebook.controller.js'
import { NotebookService } from './notebook.service.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { CollaborationModule } from '../collaboration/collaboration.module.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    CollaborationModule,
  ],
  controllers: [NotebookController],
  providers: [NotebookService, PrismaService, JwtAuthGuard],
  exports: [NotebookService],
})
export class NotebookModule {}
