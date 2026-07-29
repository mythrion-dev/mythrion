import { Module, forwardRef } from '@nestjs/common'
import { AdventureService } from './adventure.service.js'
import { AdventureController } from './adventure.controller.js'
import { AdventureTemplateController } from './adventure-template.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { AuthModule } from '../auth/auth.module.js'
import { JwtModule } from '@nestjs/jwt'
import { CollaborationModule } from '../collaboration/collaboration.module.js'
import { CharacterSheetModule } from '../character-sheet/character-sheet.module.js'
import { TemplateModule } from '../template/template.module.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    forwardRef(() => AuthModule),
    CollaborationModule,
    CharacterSheetModule,
    TemplateModule,
  ],
  controllers: [AdventureController, AdventureTemplateController],
  providers: [AdventureService, PrismaService, JwtAuthGuard],
  exports: [AdventureService],
})
export class AdventureModule {}
