import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NetWorthService } from './net-worth.service';
import { NetWorthController } from './net-worth.controller';
import { Asset } from '../assets/entities/asset.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NetWorthHistory } from './entities/net-worth-history.entity';
import { PositionModule } from '../position/position.module';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Liability, Transaction, NetWorthHistory]),
    PositionModule,
    PricesModule,
  ],
  providers: [NetWorthService],
  controllers: [NetWorthController],
  exports: [NetWorthService],
})
export class NetWorthModule {}
