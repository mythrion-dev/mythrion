import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
