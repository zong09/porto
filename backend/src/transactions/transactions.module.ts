import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { Asset } from '../assets/entities/asset.entity';
import { PositionModule } from '../position/position.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Asset]),
    PositionModule,
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
