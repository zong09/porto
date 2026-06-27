import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { LiabilityTransaction } from '../liabilities/entities/liability-transaction.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portfolio,
      Asset,
      Transaction,
      Liability,
      LiabilityTransaction,
      NetWorthHistory,
    ]),
  ],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
