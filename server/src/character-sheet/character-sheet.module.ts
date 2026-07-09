import { Module } from '@nestjs/common'
import { CharacterSheetService } from './character-sheet.service.js'
import { CharacterSheetController } from './character-sheet.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { JwtModule } from '@nestjs/jwt'
import { CollaborationModule } from '../collaboration/collaboration.module.js'
import { FormulaModule } from '../formula/formula.module.js'
import { ResistanceCalculationService } from './resistance-calculation.service.js'
import { AcCalculationService } from './ac-calculation.service.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    CollaborationModule,
    FormulaModule,
  ],
  controllers: [CharacterSheetController],
  providers: [CharacterSheetService, PrismaService, JwtAuthGuard, ResistanceCalculationService, AcCalculationService],
  exports: [CharacterSheetService, ResistanceCalculationService, AcCalculationService],
})
export class CharacterSheetModule {}
