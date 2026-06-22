import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { PositionService } from '../position/position.service';
import { PricesService } from '../prices/prices.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    private positionService: PositionService,
    private pricesService: PricesService,
  ) {}

  async findAll(userId: string): Promise<any[]> {
    const assets = await this.assetRepo
      .createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .leftJoinAndSelect('asset.transactions', 'transactions')
      .where('portfolio.userId = :userId', { userId })
      .orderBy('asset.symbol', 'ASC')
      .getMany();

    const enriched: any[] = [];
    for (const asset of assets) {
      const simpleTxs = (asset.transactions || []).map((t) => ({
        quantity: Number(t.quantity),
        price: Number(t.price),
        fee: Number(t.fee),
        side: t.side,
        date: t.date,
      }));
      const position = this.positionService.calculate(simpleTxs);

      let currentPrice = 0;
      let change24h = 0;

      if (asset.type === 'deposit') {
        currentPrice = 1;
      } else if (asset.type === 'fund') {
        currentPrice = Number(asset.manualPrice || 0);
      } else {
        try {
          if (asset.type === 'crypto' && asset.cgId) {
            const data = await this.pricesService.getCryptoPrices(
              [asset.cgId],
              ['thb', 'usd'],
            );
            const val = data?.[asset.cgId];
            if (val) {
              currentPrice = Number(val.thb || 0);
              change24h = Number(val.thb_24h_change || 0);
            }
          } else if (
            (asset.type === 'th' || asset.type === 'us') &&
            asset.yahooSymbol
          ) {
            const data = await this.pricesService.getStockPrice(
              asset.yahooSymbol,
            );
            if (data) {
              currentPrice = Number(data.price || 0);
              change24h = Number(data.chg || 0);
            }
          }
        } catch (e) {
          currentPrice = Number(asset.manualPrice || position.avgCost || 0);
        }
      }

      enriched.push({
        id: asset.id,
        portfolioId: asset.portfolioId,
        type: asset.type,
        symbol: asset.symbol,
        name: asset.name,
        currency: asset.currency,
        cgId: asset.cgId,
        yahooSymbol: asset.yahooSymbol,
        manualPrice: asset.manualPrice,
        portfolio: {
          id: asset.portfolio.id,
          name: asset.portfolio.name,
          color: asset.portfolio.color,
        },
        currentPrice,
        change24h,
        position,
      });
    }

    return enriched;
  }

  async findOne(id: string, userId: string): Promise<any> {
    const asset = await this.assetRepo
      .createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .leftJoinAndSelect('asset.transactions', 'transactions')
      .where('asset.id = :id', { id })
      .andWhere('portfolio.userId = :userId', { userId })
      .getOne();

    if (!asset) {
      throw new NotFoundException('ไม่พบสินทรัพย์นี้');
    }

    const simpleTxs = (asset.transactions || []).map((t) => ({
      quantity: Number(t.quantity),
      price: Number(t.price),
      fee: Number(t.fee),
      side: t.side,
      date: t.date,
    }));
    const position = this.positionService.calculate(simpleTxs);

    let currentPrice = 0;
    let change24h = 0;

    if (asset.type === 'deposit') {
      currentPrice = 1;
    } else if (asset.type === 'fund') {
      currentPrice = Number(asset.manualPrice || 0);
    } else {
      try {
        if (asset.type === 'crypto' && asset.cgId) {
          const data = await this.pricesService.getCryptoPrices(
            [asset.cgId],
            ['thb', 'usd'],
          );
          const val = data?.[asset.cgId];
          if (val) {
            // Return the price in the asset's native currency; the frontend converts for display.
            const q = (asset.currency || 'THB').toLowerCase(); // 'thb' | 'usd'
            currentPrice = Number(val[q] || 0);
            change24h = Number(val[`${q}_24h_change`] || 0);
          }
        } else if (
          (asset.type === 'th' || asset.type === 'us') &&
          asset.yahooSymbol
        ) {
          const data = await this.pricesService.getStockPrice(
            asset.yahooSymbol,
          );
          if (data) {
            currentPrice = Number(data.price || 0);
            change24h = Number(data.chg || 0);
          }
        }
      } catch (e) {
        currentPrice = Number(asset.manualPrice || position.avgCost || 0);
      }
    }

    return {
      id: asset.id,
      portfolioId: asset.portfolioId,
      type: asset.type,
      symbol: asset.symbol,
      name: asset.name,
      currency: asset.currency,
      cgId: asset.cgId,
      yahooSymbol: asset.yahooSymbol,
      manualPrice: asset.manualPrice,
      portfolio: {
        id: asset.portfolio.id,
        name: asset.portfolio.name,
        color: asset.portfolio.color,
      },
      currentPrice,
      change24h,
      position,
    };
  }

  async create(
    userId: string,
    portfolioId: string,
    type: 'crypto' | 'th' | 'us' | 'fund' | 'deposit',
    symbol: string,
    name: string,
    currency: 'THB' | 'USD',
    cgId?: string,
    yahooSymbol?: string,
    manualPrice?: number,
  ): Promise<Asset> {
    // Verify portfolio ownership
    const portfolio = await this.portfolioRepo.findOne({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงพอร์ตการลงทุนนี้');
    }

    const asset = this.assetRepo.create({
      portfolioId,
      type,
      symbol,
      name: name || symbol,
      currency,
      cgId: cgId || null,
      yahooSymbol: yahooSymbol || null,
      manualPrice: manualPrice !== undefined ? manualPrice : null,
    } as any) as any as Asset;

    return this.assetRepo.save(asset);
  }

  async update(
    id: string,
    userId: string,
    name?: string,
    manualPrice?: number,
  ): Promise<Asset> {
    const asset = await this.assetRepo
      .createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .where('asset.id = :id', { id })
      .andWhere('portfolio.userId = :userId', { userId })
      .getOne();

    if (!asset) {
      throw new NotFoundException('ไม่พบสินทรัพย์นี้');
    }

    if (name !== undefined) {
      asset.name = name;
    }
    if (manualPrice !== undefined) {
      asset.manualPrice = manualPrice;
    }

    return this.assetRepo.save(asset);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.assetRepo.delete(id);
  }
}
