import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ENTITIES } from './entities';
import {
  validateEnv,
  isLocalDatabaseUrl,
  shouldSynchronize,
} from './config/env.validation';

import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { PositionModule } from './position/position.module';
import { PricesModule } from './prices/prices.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { LiabilitiesModule } from './liabilities/liabilities.module';
import { NetWorthModule } from './net-worth/net-worth.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        // Dev auto-syncs the schema; prod applies committed migrations on boot
        // instead, so entity refactors can't silently mangle live data. This no
        // longer hinges on an unvalidated string: env.validation.ts rejects a
        // malformed NODE_ENV outright and refuses to boot when a remote database
        // is paired with a non-production NODE_ENV, which is the case that used
        // to turn auto-sync on against live data.
        const schemaOptions = {
          entities: ENTITIES,
          synchronize: shouldSynchronize(
            config.get<string>('NODE_ENV'),
            config.get<string>('DB_SYNC'),
          ),
          migrations: [join(__dirname, 'migrations', '*.js')],
          migrationsRun: isProd,
        };
        if (url) {
          return {
            type: 'postgres' as const,
            url,
            ...schemaOptions,
            // Railway's Postgres proxy presents a self-signed cert and exposes
            // no CA bundle, so verification stays off (documented accepted
            // risk M2). The host check is hostname-based, not a substring
            // match, so `db.localhost.attacker.com` can't disable TLS.
            ssl: isLocalDatabaseUrl(url) ? false : { rejectUnauthorized: false },
          };
        }
        // Local-only defaults for the dev container. These are reachable only
        // when NODE_ENV is not production — env.validation.ts requires
        // DATABASE_URL in production, so a deployed box can no longer fall
        // through to these committed credentials.
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5435), // matches the dev container's 5435
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgrespassword'),
          database: config.get<string>('DB_DATABASE', 'porto'),
          ...schemaOptions,
        };
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/*path'],
    }),
    AuthModule,
    SeedModule,
    PositionModule,
    PricesModule,
    PortfoliosModule,
    AssetsModule,
    TransactionsModule,
    LiabilitiesModule,
    NetWorthModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
