import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const rawUrl = process.env.DATABASE_URL!;
    // PrismaPg (which uses the `pg` driver) expects a standard postgres:// URL.
    // The prisma+postgres:// prefix (used by Prisma Accelerate) is not supported
    // by the pg driver, so we strip the "prisma+" prefix if present.
    const pgUrl = rawUrl.replace(/^prisma\+/, '');
    // Use a pg.Pool instead of a raw connection string to enable concurrent
    // queries without hitting pg's "client already executing" deprecation warning.
    const pool = new pg.Pool({
      connectionString: pgUrl,
      max: 20, // Allow up to 20 concurrent connections
      idleTimeoutMillis: 30_000, // Close idle connections after 30s
      connectionTimeoutMillis: 10_000, // Fail fast if a connection cannot be acquired
    });
    const adapter = new PrismaPg(pool);
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