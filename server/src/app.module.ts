import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma.service.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AdventureModule } from './adventure/adventure.module.js';
import { TemplateModule } from './template/template.module.js';
import { CharacterSheetModule } from './character-sheet/character-sheet.module.js';
import { FormulaModule } from './formula/formula.module.js';
@Module({
  imports: [AuthModule, AdventureModule, TemplateModule, CharacterSheetModule, FormulaModule],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}