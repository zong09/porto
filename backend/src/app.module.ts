import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { User } from './users/entities/user.entity';
import { Portfolio } from './portfolios/entities/portfolio.entity';
import { Asset } from './assets/entities/asset.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { Liability } from './liabilities/entities/liability.entity';
import { LiabilityTransaction } from './liabilities/entities/liability-transaction.entity';
import { NetWorthHistory } from './net-worth/entities/net-worth-history.entity';

import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { PositionModule } from './position/position.module';
import { PricesModule } from './prices/prices.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { LiabilitiesModule } from './liabilities/liabilities.module';
import { NetWorthModule } from './net-worth/net-worth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (url) {
          return {
            type: 'postgres',
            url,
            entities: [
              User,
              Portfolio,
              Asset,
              Transaction,
              Liability,
              LiabilityTransaction,
              NetWorthHistory,
            ],
            synchronize: true,
            ssl:
              url.includes('localhost') || url.includes('127.0.0.1')
                ? false
                : { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5435), // Updated default port to match dev container 5435
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgrespassword'),
          database: config.get<string>('DB_DATABASE', 'porto'),
          entities: [
            User,
            Portfolio,
            Asset,
            Transaction,
            Liability,
            LiabilityTransaction,
            NetWorthHistory,
          ],
          synchronize: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
