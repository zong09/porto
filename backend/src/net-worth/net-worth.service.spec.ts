import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NetWorthService } from './net-worth.service';
import { Asset } from '../assets/entities/asset.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NetWorthHistory } from './entities/net-worth-history.entity';
import { PositionService } from '../position/position.service';
import { PricesService } from '../prices/prices.service';

const mockAsset = {
  id: 'asset-1',
  type: 'crypto',
  symbol: 'BTC',
  currency: 'USD',
  cgId: 'bitcoin',
  transactions: [],
};

const mockLiability = {
  id: 'liability-1',
  amount: 2000,
};

const mockNetWorthHistory = {
  id: 'nw-history-1',
  userId: 'user-1',
  date: '2026-01-01',
  totalAssetsThb: 100000,
  totalLiabilitiesThb: 2000,
  netWorthThb: 98000,
  fxRate: 35.84,
};

describe('NetWorthService', () => {
  let service: NetWorthService;
  let assetRepo: Repository<Asset>;
  let liabilityRepo: Repository<Liability>;
  let netWorthHistoryRepo: Repository<NetWorthHistory>;
  let pricesService: PricesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetWorthService,
        {
          provide: getRepositoryToken(Asset),
          useValue: {
            find: jest.fn().mockResolvedValue([mockAsset]),
          },
        },
        {
          provide: getRepositoryToken(Liability),
          useValue: {
            find: jest.fn().mockResolvedValue([mockLiability]),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(NetWorthHistory),
          useValue: {
            find: jest.fn().mockResolvedValue([mockNetWorthHistory]),
            findOne: jest.fn().mockResolvedValue(mockNetWorthHistory),
            create: jest.fn().mockReturnValue(mockNetWorthHistory),
            save: jest.fn().mockResolvedValue(mockNetWorthHistory),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockNetWorthHistory]),
            }),
          },
        },
        {
          provide: PositionService,
          useValue: {
            calculate: jest
              .fn()
              .mockReturnValue({ quantity: 1, avgCost: 50000 }),
          },
        },
        {
          provide: PricesService,
          useValue: {
            getFxRate: jest.fn().mockResolvedValue(35),
            getCryptoPrices: jest.fn().mockResolvedValue({
              bitcoin: { usd: 60000, usd_24h_change: 2.5 },
            }),
            getStockPrice: jest.fn().mockResolvedValue({
              price: 150,
              chg: 1.2,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NetWorthService>(NetWorthService);
    assetRepo = module.get<Repository<Asset>>(getRepositoryToken(Asset));
    liabilityRepo = module.get<Repository<Liability>>(
      getRepositoryToken(Liability),
    );
    netWorthHistoryRepo = module.get<Repository<NetWorthHistory>>(
      getRepositoryToken(NetWorthHistory),
    );
    pricesService = module.get<PricesService>(PricesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should compute and return correct net worth details', async () => {
      const summary = await service.getSummary('user-1');
      expect(summary).toEqual({
        totalAssetsThb: 60000 * 35,
        totalLiabilitiesThb: 2000,
        netWorthThb: 60000 * 35 - 2000,
        todayPlThb: 60000 * 35 - (60000 * 35) / (1 + 2.5 / 100),
        totalCostThb: 50000 * 35,
        fx: 35,
      });
    });

    it('should handle price fetch errors safely', async () => {
      jest
        .spyOn(pricesService, 'getCryptoPrices')
        .mockRejectedValue(new Error('CoinGecko failed'));
      const summary = await service.getSummary('user-1');
      expect(summary).toBeDefined();
    });
  });

  describe('getHistory', () => {
    it('should return net worth history items', async () => {
      const result = await service.getHistory('user-1', 30);
      expect(result).toEqual([mockNetWorthHistory]);
    });
  });

  describe('recordSnapshot', () => {
    it('should create new or update existing snapshot for today', async () => {
      const result = await service.recordSnapshot('user-1');
      expect(result).toEqual(mockNetWorthHistory);
    });
  });
});
