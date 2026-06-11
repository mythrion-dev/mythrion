import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma.service.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AdventureModule } from './adventure/adventure.module.js';
import { GoogleModule } from './google_OAuth/google.module.js'
import { GoogleController } from './google_OAuth/google.controller.js';
import { GoogleService } from './google_OAuth/google.service.js';
import { GoogleStrategy } from './google_OAuth/google.strategy.js';

@Module({
  imports: [AuthModule, AdventureModule, GoogleModule],
  controllers: [AppController, HealthController, GoogleController],
  providers: [AppService, PrismaService, GoogleService, GoogleStrategy],
  exports: [PrismaService],
})
export class AppModule {}
