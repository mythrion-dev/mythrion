import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  discordAccount: any;

  constructor() {
    const rawUrl = process.env.DATABASE_URL!;
    // PrismaPg (which uses the `pg` driver) expects a standard postgres:// URL.
    // The prisma+postgres:// prefix (used by Prisma Accelerate) is not supported
    // by the pg driver, so we strip the "prisma+" prefix if present.
    const pgUrl = rawUrl.replace(/^prisma\+/, '');
    const adapter = new PrismaPg(pgUrl);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (err) {
      this.logger.error(
        `Failed to connect to database: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}