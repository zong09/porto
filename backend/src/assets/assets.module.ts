import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './entities/asset.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { PositionModule } from '../position/position.module';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Portfolio]),
    PositionModule,
    PricesModule,
  ],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
