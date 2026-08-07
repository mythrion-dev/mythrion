import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma.service.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AdventureModule } from './adventure/adventure.module.js';
import { TemplateModule } from './template/template.module.js';
import { CharacterSheetModule } from './character-sheet/character-sheet.module.js';
import { FormulaModule } from './formula/formula.module.js';
import { ImageModule } from './image/image.module.js';
import { RedisModule } from './redis/redis.module.js';
import { BookModule } from './book/book.module.js';
import { NotebookModule } from './notebook/notebook.module.js';
import { JoinRequestModule } from './join-request/join-request.module.js';
import { CommunityModule } from './community/community.module.js';
import { SubscriptionModule } from './subscription/subscription.module.js';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      fallbacks: { pt: 'pt-BR' },
      loaderOptions: {
        path: join(__dirname, '..', 'i18n'),
        watch: false,
      },
      resolvers: [new AcceptLanguageResolver()],
      throwOnMissingKey: false,
    }),
    AuthModule,
    AdventureModule,
    TemplateModule,
    CharacterSheetModule,
    FormulaModule,
    ImageModule,
    RedisModule,
    BookModule,
    NotebookModule,
    SubscriptionModule,
    JoinRequestModule,
    CommunityModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
