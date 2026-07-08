import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
    @InjectRepository(NetWorthHistory)
    private netWorthRepo: Repository<NetWorthHistory>,
  ) {}

  async seedDemoUser(userId: string): Promise<void> {
    this.logger.log(`Starting to seed demo data for user=${userId}`);
    const now = new Date();
    const dayMs = 86400000;
    const dateNDaysAgo = (n: number) => {
      const d = new Date(now.getTime() - n * dayMs);
      return d.toISOString().slice(0, 10);
    };

    // 1. Portfolios
    const p1 = this.portfolioRepo.create({ userId, name: 'เก็บออม', color: 0 });
    const p2 = this.portfolioRepo.create({
      userId,
      name: 'ลงทุนระยะยาว',
      color: 1,
    });
    const p3 = this.portfolioRepo.create({ userId, name: 'Gamble', color: 2 });
    const portfolios = await this.portfolioRepo.save([p1, p2, p3]);

    const portMap = {
      p1: portfolios[0],
      p2: portfolios[1],
      p3: portfolios[2],
    };

    // 2. Assets
    const assetsData = [
      {
        key: 'a1',
        portfolioId: portMap.p1.id,
        type: 'deposit',
        symbol: 'SCB e-Savings',
        name: 'บัญชีออมทรัพย์ SCB',
        currency: 'THB',
      },
      {
        key: 'a2',
        portfolioId: portMap.p1.id,
        type: 'fund',
        symbol: 'K-CHANGE-A(A)',
        name: 'กองทุน K-CHANGE',
        currency: 'THB',
        manualPrice: 14.31,
      },
      {
        key: 'a3',
        portfolioId: portMap.p2.id,
        type: 'us',
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        currency: 'USD',
        yahooSymbol: 'NVDA',
      },
      {
        key: 'a4',
        portfolioId: portMap.p2.id,
        type: 'us',
        symbol: 'AAPL',
        name: 'Apple Inc',
        currency: 'USD',
        yahooSymbol: 'AAPL',
      },
      {
        key: 'a5',
        portfolioId: portMap.p2.id,
        type: 'us',
        symbol: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        currency: 'USD',
        yahooSymbol: 'VOO',
      },
      {
        key: 'a6',
        portfolioId: portMap.p2.id,
        type: 'th',
        symbol: 'PTT',
        name: 'ปตท.',
        currency: 'THB',
        yahooSymbol: 'PTT.BK',
      },
      {
        key: 'a7',
        portfolioId: portMap.p2.id,
        type: 'th',
        symbol: 'CPALL',
        name: 'ซีพี ออลล์',
        currency: 'THB',
        yahooSymbol: 'CPALL.BK',
      },
      {
        key: 'a8',
        portfolioId: portMap.p3.id,
        type: 'crypto',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        cgId: 'bitcoin',
      },
      {
        key: 'a9',
        portfolioId: portMap.p3.id,
        type: 'crypto',
        symbol: 'ETH',
        name: 'Ethereum',
        currency: 'USD',
        cgId: 'ethereum',
      },
      {
        key: 'a10',
        portfolioId: portMap.p3.id,
        type: 'crypto',
        symbol: 'SOL',
        name: 'Solana',
        currency: 'USD',
        cgId: 'solana',
      },
    ];

    const savedAssets: Record<string, Asset> = {};
    for (const item of assetsData) {
      const { key, ...rest } = item;
      const asset = this.assetRepo.create(rest as any) as any as Asset;
      const saved = await this.assetRepo.save(asset);
      savedAssets[key] = saved;
    }

    // 3. Transactions
    const txsData: Array<{
      assetId: string;
      side: 'buy' | 'sell' | 'deposit' | 'withdraw';
      quantity: number;
      price: number;
      fee: number;
      date: string;
    }> = [
      {
        assetId: savedAssets.a1.id,
        side: 'buy',
        quantity: 400000,
        price: 1,
        fee: 0,
        date: dateNDaysAgo(360),
      },
      {
        assetId: savedAssets.a1.id,
        side: 'buy',
        quantity: 120000,
        price: 1,
        fee: 0,
        date: dateNDaysAgo(180),
      },
      {
        assetId: savedAssets.a1.id,
        side: 'buy',
        quantity: 100000,
        price: 1,
        fee: 0,
        date: dateNDaysAgo(45),
      },
      {
        assetId: savedAssets.a2.id,
        side: 'buy',
        quantity: 20000,
        price: 12.8,
        fee: 0,
        date: dateNDaysAgo(300),
      },
      {
        assetId: savedAssets.a2.id,
        side: 'buy',
        quantity: 15000,
        price: 13.4,
        fee: 0,
        date: dateNDaysAgo(120),
      },
      {
        assetId: savedAssets.a3.id,
        side: 'buy',
        quantity: 10,
        price: 88,
        fee: 0,
        date: dateNDaysAgo(330),
      },
      {
        assetId: savedAssets.a3.id,
        side: 'buy',
        quantity: 4,
        price: 116,
        fee: 0,
        date: dateNDaysAgo(150),
      },
      {
        assetId: savedAssets.a4.id,
        side: 'buy',
        quantity: 18,
        price: 189.5,
        fee: 0,
        date: dateNDaysAgo(280),
      },
      {
        assetId: savedAssets.a5.id,
        side: 'buy',
        quantity: 9,
        price: 468,
        fee: 0,
        date: dateNDaysAgo(250),
      },
      {
        assetId: savedAssets.a6.id,
        side: 'buy',
        quantity: 6000,
        price: 35.5,
        fee: 0,
        date: dateNDaysAgo(310),
      },
      {
        assetId: savedAssets.a7.id,
        side: 'buy',
        quantity: 3000,
        price: 61.75,
        fee: 0,
        date: dateNDaysAgo(200),
      },
      {
        assetId: savedAssets.a8.id,
        side: 'buy',
        quantity: 0.2,
        price: 65000,
        fee: 0,
        date: dateNDaysAgo(340),
      },
      {
        assetId: savedAssets.a8.id,
        side: 'sell',
        quantity: 0.05,
        price: 92000,
        fee: 0,
        date: dateNDaysAgo(60),
      },
      {
        assetId: savedAssets.a9.id,
        side: 'buy',
        quantity: 1.2,
        price: 3300,
        fee: 0,
        date: dateNDaysAgo(220),
      },
      {
        assetId: savedAssets.a10.id,
        side: 'buy',
        quantity: 18,
        price: 130,
        fee: 0,
        date: dateNDaysAgo(90),
      },
    ];

    const txs = this.transactionRepo.create(txsData);
    await this.transactionRepo.save(txs);

    // 4. Liabilities
    const liabilitiesData = [
      { userId, name: 'สินเชื่อรถ', amount: 385000 },
      { userId, name: 'กยศ.', amount: 137000 },
      { userId, name: 'บัตรเครดิต', amount: 42500 },
    ];
    const liabilities = this.liabilityRepo.create(liabilitiesData);
    await this.liabilityRepo.save(liabilities);

    // 5. Net Worth History (12 Months)
    const base = [
      2.18, 2.22, 2.2, 2.31, 2.28, 2.42, 2.39, 2.52, 2.61, 2.58, 2.72, 2.8,
    ];
    const histories: NetWorthHistory[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getTime() - (11 - i) * 30 * dayMs)
        .toISOString()
        .slice(0, 10);
      const netWorth = Math.round(base[i] * 1000000);
      const totalLiabilities = 564500;
      histories.push(
        this.netWorthRepo.create({
          userId,
          date,
          totalLiabilitiesThb: totalLiabilities,
          totalAssetsThb: netWorth + totalLiabilities,
          netWorthThb: netWorth,
        }),
      );
    }
    await this.netWorthRepo.save(histories);
    this.logger.log(
      `Successfully seeded demo data for user=${userId}: 3 portfolios, 10 assets, 15 transactions, 3 liabilities, 12 months history`,
    );
  }
}
