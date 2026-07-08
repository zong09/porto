import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { PositionService } from '../position/position.service';
import { PricesService } from '../prices/prices.service';

@Injectable()
export class AssetsService implements OnModuleInit {
  private readonly logger = new Logger(AssetsService.name);
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    private positionService: PositionService,
    private pricesService: PricesService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      'Running DB migration: CoinGecko IDs to Binance Symbols...',
    );
    const cgToBinanceMap: Record<string, string> = {
      bitcoin: 'BTC',
      ethereum: 'ETH',
      solana: 'SOL',
      binancecoin: 'BNB',
      ripple: 'XRP',
      cardano: 'ADA',
      dogecoin: 'DOGE',
      polkadot: 'DOT',
      'matic-network': 'MATIC',
      'avalanche-2': 'AVAX',
      chainlink: 'LINK',
      uniswap: 'UNI',
      litecoin: 'LTC',
      near: 'NEAR',
      cosmos: 'ATOM',
      optimism: 'OP',
      arbitrum: 'ARB',
      sui: 'SUI',
      aptos: 'APT',
      pepe: 'PEPE',
      'shiba-inu': 'SHIB',
      'the-open-network': 'TON',
      tron: 'TRX',
      tether: 'USDT',
      'usd-coin': 'USDC',
    };

    let updatedCount = 0;
    for (const [cgId, sym] of Object.entries(cgToBinanceMap)) {
      const result = await this.assetRepo.update(
        { type: 'crypto', symbol: cgId },
        { symbol: sym },
      );
      if (result.affected && result.affected > 0) {
        updatedCount += result.affected;
      }
    }
    if (updatedCount > 0) {
      this.logger.log(
        `Successfully migrated ${updatedCount} crypto assets to Binance symbols.`,
      );
    }
  }

  async findAll(userId: string): Promise<any[]> {
    this.logger.log(`Fetching all assets for user=${userId}`);
    const assets = await this.assetRepo
      .createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .leftJoinAndSelect('asset.transactions', 'transactions')
      .where('portfolio.userId = :userId', { userId })
      .orderBy('asset.sortOrder', 'ASC')
      .addOrderBy('asset.symbol', 'ASC')
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
      const position = this.positionService.calculate(
        simpleTxs,
        asset.direction || 'long',
      );

      let currentPrice = 0;
      let change24h = 0;

      if (asset.type === 'deposit') {
        currentPrice = 1;
      } else if (asset.type === 'fund') {
        currentPrice = Number(asset.manualPrice || 0);
      } else {
        try {
          if (asset.type === 'crypto' && asset.symbol) {
            const data = await this.pricesService.getCryptoPrices(
              [asset.symbol],
              ['thb', 'usd'],
            );
            const val = data?.[asset.symbol];
            if (val) {
              const q = (asset.currency || 'THB').toLowerCase();
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
        sortOrder: asset.sortOrder,
        direction: asset.direction || 'long',
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

    this.logger.log(
      `Returning ${enriched.length} enriched assets for user=${userId}`,
    );
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
    const position = this.positionService.calculate(
      simpleTxs,
      asset.direction || 'long',
    );

    let currentPrice = 0;
    let change24h = 0;

    if (asset.type === 'deposit') {
      currentPrice = 1;
    } else if (asset.type === 'fund') {
      currentPrice = Number(asset.manualPrice || 0);
    } else {
      try {
        if (asset.type === 'crypto' && asset.symbol) {
          const data = await this.pricesService.getCryptoPrices(
            [asset.symbol],
            ['thb', 'usd'],
          );
          const val = data?.[asset.symbol];
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
      sortOrder: asset.sortOrder,
      direction: asset.direction || 'long',
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
    direction?: 'long' | 'short',
  ): Promise<Asset> {
    this.logger.log(
      `Creating asset symbol=${symbol} type=${type} currency=${currency} direction=${direction || 'long'} in portfolio=${portfolioId}`,
    );
    // Verify portfolio ownership
    const portfolio = await this.portfolioRepo.findOne({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงพอร์ตการลงทุนนี้');
    }

    // Auto-set sortOrder to append at end within same portfolio
    const count = await this.assetRepo.count({ where: { portfolioId } });

    const asset = this.assetRepo.create({
      portfolioId,
      type,
      symbol,
      name: name || symbol,
      currency,
      cgId: cgId || null,
      yahooSymbol: yahooSymbol || null,
      manualPrice: manualPrice !== undefined ? manualPrice : null,
      direction: direction || 'long',
      sortOrder: count,
    } as any) as any as Asset;

    const saved = await this.assetRepo.save(asset);
    this.logger.log(`Asset created id=${saved.id} symbol=${symbol}`);
    return saved;
  }

  async update(
    id: string,
    userId: string,
    name?: string,
    manualPrice?: number,
  ): Promise<Asset> {
    this.logger.log(`Updating asset id=${id}`);
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

    const saved = await this.assetRepo.save(asset);
    this.logger.log(`Asset updated successfully id=${id}`);
    return saved;
  }

  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    this.logger.log(
      `Reordering ${orderedIds.length} assets for user=${userId}`,
    );
    // Verify all IDs belong to this user by joining with portfolio
    const assets = await this.assetRepo
      .createQueryBuilder('asset')
      .innerJoin('asset.portfolio', 'portfolio')
      .where('portfolio.userId = :userId', { userId })
      .andWhere('asset.id IN (:...ids)', { ids: orderedIds })
      .select('asset.id')
      .getMany();

    const userAssetIds = new Set(assets.map((a) => a.id));
    for (const id of orderedIds) {
      if (!userAssetIds.has(id)) {
        throw new BadRequestException('สินทรัพย์บางรายการไม่ถูกต้อง');
      }
    }

    // Bulk update sortOrder
    const updates = orderedIds.map((id, index) =>
      this.assetRepo.update(id, { sortOrder: index }),
    );
    await Promise.all(updates);
    this.logger.log(
      `Successfully reordered ${orderedIds.length} assets for user=${userId}`,
    );
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting asset id=${id} for user=${userId}`);
    await this.findOne(id, userId);
    await this.assetRepo.delete(id);
    this.logger.log(`Asset deleted id=${id}`);
  }
}
