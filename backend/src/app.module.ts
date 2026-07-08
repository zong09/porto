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
    ConfigModule.forRoot({ isGlobal: true }),
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
        // Dev auto-syncs the schema; prod applies committed migrations on
        // boot instead, so entity refactors can't silently mangle live data.
        const schemaOptions = {
          entities: ENTITIES,
          synchronize: !isProd,
          migrations: [join(__dirname, 'migrations', '*.js')],
          migrationsRun: isProd,
        };
        if (url) {
          return {
            type: 'postgres' as const,
            url,
            ...schemaOptions,
            ssl:
              url.includes('localhost') || url.includes('127.0.0.1')
                ? false
                : { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5435), // Updated default port to match dev container 5435
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
