import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiabilitiesService } from './liabilities.service';
import { LiabilitiesController } from './liabilities.controller';
import { Liability } from './entities/liability.entity';
import { LiabilityTransaction } from './entities/liability-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liability, LiabilityTransaction])],
  providers: [LiabilitiesService],
  controllers: [LiabilitiesController],
  exports: [LiabilitiesService],
})
export class LiabilitiesModule {}
