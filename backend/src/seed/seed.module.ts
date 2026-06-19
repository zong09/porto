import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portfolio,
      Asset,
      Transaction,
      Liability,
      NetWorthHistory,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
