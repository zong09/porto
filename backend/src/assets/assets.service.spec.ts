import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetsService } from './assets.service';
import { Asset } from './entities/asset.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { PositionService } from '../position/position.service';
import { PricesService } from '../prices/prices.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

const mockAsset = {
  id: 'asset-1',
  portfolioId: 'port-1',
  type: 'crypto',
  symbol: 'BTC',
  name: 'Bitcoin',
  currency: 'USD',
  cgId: 'bitcoin',
  yahooSymbol: null,
  manualPrice: null,
  direction: 'long',
  sortOrder: 0,
  portfolio: {
    id: 'port-1',
    name: 'Main Port',
    color: 1,
    userId: 'user-1',
  },
  transactions: [],
};

describe('AssetsService', () => {
  let service: AssetsService;
  let assetRepo: Repository<Asset>;
  let portfolioRepo: Repository<Portfolio>;
  let pricesService: PricesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: getRepositoryToken(Asset),
          useValue: {
            find: jest.fn().mockResolvedValue([mockAsset]),
            findOne: jest.fn().mockResolvedValue(mockAsset),
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockReturnValue(mockAsset),
            save: jest.fn().mockResolvedValue(mockAsset),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
              innerJoinAndSelect: jest.fn().mockReturnThis(),
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockAsset]),
              getOne: jest.fn().mockResolvedValue(mockAsset),
            }),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 'port-1', userId: 'user-1' }),
          },
        },
        {
          provide: PositionService,
          useValue: {
            calculate: jest.fn().mockReturnValue({
              quantity: 1,
              avgCost: 50000,
              direction: 'long',
            }),
          },
        },
        {
          provide: PricesService,
          useValue: {
            getCryptoPrices: jest.fn().mockResolvedValue({
              bitcoin: {
                usd: 60000,
                usd_24h_change: 2.5,
                thb: 2100000,
                thb_24h_change: 2.3,
              },
            }),
            getStockPrice: jest.fn().mockResolvedValue({
              price: 150,
              chg: 1.2,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    assetRepo = module.get<Repository<Asset>>(getRepositoryToken(Asset));
    portfolioRepo = module.get<Repository<Portfolio>>(
      getRepositoryToken(Portfolio),
    );
    pricesService = module.get<PricesService>(PricesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return enriched assets list for user', async () => {
      const result = await service.findAll('user-1');
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].currentPrice).toBe(60000);
    });

    it('should fall back to manualPrice or avgCost on price fetch error', async () => {
      jest
        .spyOn(pricesService, 'getCryptoPrices')
        .mockRejectedValue(new Error('Network error'));
      const customAsset = {
        ...mockAsset,
        manualPrice: 45000,
      };
      const qb = assetRepo.createQueryBuilder();
      jest.spyOn(qb, 'getMany').mockResolvedValue([customAsset]);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(qb);

      const result = await service.findAll('user-1');
      expect(result[0].currentPrice).toBe(45000);
    });
  });

  describe('findOne', () => {
    it('should return single enriched asset by ID', async () => {
      const result = await service.findOne('asset-1', 'user-1');
      expect(result).toBeDefined();
      expect(result.currentPrice).toBe(60000);
    });

    it('should throw NotFoundException if asset not found', async () => {
      const qb = assetRepo.createQueryBuilder();
      jest.spyOn(qb, 'getOne').mockResolvedValue(null);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(qb);

      await expect(service.findOne('invalid-asset', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should successfully create asset', async () => {
      const result = await service.create(
        'user-1',
        'port-1',
        'crypto',
        'BTC',
        'Bitcoin',
        'USD',
        'bitcoin',
      );
      expect(result).toBeDefined();
      expect(assetRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if portfolio not owned by user', async () => {
      jest.spyOn(portfolioRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.create('user-1', 'port-2', 'crypto', 'BTC', 'Bitcoin', 'USD'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should successfully update and return the asset', async () => {
      const result = await service.update(
        'asset-1',
        'user-1',
        'New Bitcoin Name',
        61000,
      );
      expect(result).toBeDefined();
      expect(assetRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if asset to update not found', async () => {
      const qb = assetRepo.createQueryBuilder();
      jest.spyOn(qb, 'getOne').mockResolvedValue(null);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(qb);

      await expect(
        service.update('invalid-asset', 'user-1', 'Name'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should successfully reorder assets', async () => {
      const ids = ['asset-1'];
      await service.reorder('user-1', ids);
      expect(assetRepo.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if some asset ID does not belong to user', async () => {
      const ids = ['asset-invalid'];
      await expect(service.reorder('user-1', ids)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete asset successfully', async () => {
      await service.remove('asset-1', 'user-1');
      expect(assetRepo.delete).toHaveBeenCalledWith('asset-1');
    });
  });
});
