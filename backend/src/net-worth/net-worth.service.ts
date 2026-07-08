import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NetWorthHistory } from './entities/net-worth-history.entity';
import { PositionService } from '../position/position.service';
import { PricesService } from '../prices/prices.service';

@Injectable()
export class NetWorthService {
  private readonly logger = new Logger(NetWorthService.name);
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(NetWorthHistory)
    private netWorthHistoryRepo: Repository<NetWorthHistory>,
    private positionService: PositionService,
    private pricesService: PricesService,
  ) {}

  async getSummary(userId: string): Promise<any> {
    this.logger.log(`Computing net-worth summary for user=${userId}`);
    // 1. Fetch assets and their transactions
    const assets = await this.assetRepo.find({
      where: { portfolio: { userId } },
      relations: { portfolio: true, transactions: true },
    });

    // 2. Fetch liabilities
    const liabilities = await this.liabilityRepo.find({
      where: { userId },
    });
    // 3. Fetch FX rate
    const fx = await this.pricesService.getFxRate();

    const totalLiabilitiesThb = liabilities.reduce((sum, l) => {
      const multiplier = l.currency === 'USD' ? fx : 1;
      return sum + Number(l.amount) * multiplier;
    }, 0);

    let totalAssetsThb = 0;
    let totalCostThb = 0;
    let todayPlThb = 0;

    for (const asset of assets) {
      // Calculate position
      const simpleTxs = asset.transactions.map((t) => ({
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

      if (position.quantity <= 0) continue;

      // Determine price
      let price = 0;
      let chg24h = 0;

      if (asset.type === 'deposit') {
        price = 1;
      } else if (asset.type === 'fund') {
        price = Number(asset.manualPrice || 0);
      } else {
        // Fetch live price
        try {
          if (asset.type === 'crypto' && asset.symbol) {
            const data = await this.pricesService.getCryptoPrices(
              [asset.symbol],
              ['thb', 'usd'],
            );
            const val = data?.[asset.symbol];
            if (val) {
              // Pick the price in the asset's native currency so the fx multiplier below converts correctly.
              const q = (asset.currency || 'THB').toLowerCase(); // 'thb' | 'usd'
              price = Number(val[q] || 0);
              chg24h = Number(val[`${q}_24h_change`] || 0);
            }
          } else if (
            (asset.type === 'th' || asset.type === 'us') &&
            asset.yahooSymbol
          ) {
            const data = await this.pricesService.getStockPrice(
              asset.yahooSymbol,
            );
            if (data) {
              price = Number(data.price || 0);
              chg24h = Number(data.chg || 0);
            }
          }
        } catch (e) {
          // Fallback to manualPrice or position avg cost
          price = Number(asset.manualPrice || position.avgCost || 0);
          this.logger.warn(
            `Failed to fetch price for asset ${asset.symbol}: ${e.message}`,
          );
        }
      }

      // Convert to THB
      // Yahoo prices for US stocks are in USD. Crypto simple price query 'thb' is already in THB.
      // So if asset.currency is USD, we multiply by fx.
      const multiplier = asset.currency === 'USD' ? fx : 1;
      const assetValThb = position.quantity * price * multiplier;
      const isShort = (asset.direction || 'long') === 'short';

      // Short positions are subtracted (they represent a liability/obligation to buy back)
      if (isShort) {
        totalAssetsThb -= assetValThb;
      } else {
        totalAssetsThb += assetValThb;
      }
      totalCostThb += position.quantity * position.avgCost * multiplier;

      // 24h P&L Calculation:
      // profit/loss of today = currentVal - currentVal / (1 + changePercent / 100)
      // For short positions, profit is reversed (price drop = profit)
      if (chg24h !== 0) {
        const rawPl = assetValThb - assetValThb / (1 + chg24h / 100);
        todayPlThb += isShort ? -rawPl : rawPl;
      }
    }

    const netWorthThb = totalAssetsThb - totalLiabilitiesThb;
    this.logger.log(
      `Net-worth summary: assets=฿${totalAssetsThb.toFixed(2)} liabilities=฿${totalLiabilitiesThb.toFixed(2)} netWorth=฿${netWorthThb.toFixed(2)} fx=${fx}`,
    );

    return {
      totalAssetsThb,
      totalLiabilitiesThb,
      netWorthThb,
      todayPlThb,
      totalCostThb,
      fx,
    };
  }

  async getHistory(userId: string, days?: number): Promise<NetWorthHistory[]> {
    const query = this.netWorthHistoryRepo
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .orderBy('history.date', 'ASC');

    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query.andWhere('history.date >= :cutoff', {
        cutoff: cutoff.toISOString().slice(0, 10),
      });
    }

    return query.getMany();
  }

  async recordSnapshot(userId: string): Promise<NetWorthHistory> {
    this.logger.log(`Recording net-worth snapshot for user=${userId}`);
    const summary = await this.getSummary(userId);
    const todayStr = new Date().toISOString().slice(0, 10);

    let history = await this.netWorthHistoryRepo.findOne({
      where: { userId, date: todayStr },
    });

    if (history) {
      this.logger.log(`Updating existing snapshot for date=${todayStr}`);
      history.totalAssetsThb = summary.totalAssetsThb;
      history.totalLiabilitiesThb = summary.totalLiabilitiesThb;
      history.netWorthThb = summary.netWorthThb;
      history.fxRate = summary.fx;
    } else {
      this.logger.log(`Creating new snapshot for date=${todayStr}`);
      history = this.netWorthHistoryRepo.create({
        userId,
        date: todayStr,
        totalAssetsThb: summary.totalAssetsThb,
        totalLiabilitiesThb: summary.totalLiabilitiesThb,
        netWorthThb: summary.netWorthThb,
        fxRate: summary.fx,
      });
    }

    return this.netWorthHistoryRepo.save(history);
  }
}
