import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiabilitiesService } from './liabilities.service';
import { LiabilitiesController } from './liabilities.controller';
import { Liability } from './entities/liability.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liability])],
  providers: [LiabilitiesService],
  controllers: [LiabilitiesController],
  exports: [LiabilitiesService],
})
export class LiabilitiesModule {}
