import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { Asset } from '../assets/entities/asset.entity';
import { PositionService } from '../position/position.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockTransaction = {
  id: 'tx-1',
  assetId: 'asset-1',
  side: 'buy',
  quantity: 10,
  price: 150,
  fee: 5,
  date: '2026-01-01',
  asset: {
    id: 'asset-1',
    type: 'us',
    portfolio: {
      id: 'port-1',
      userId: 'user-1',
    },
  },
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionRepo: Repository<Transaction>;
  let assetRepo: Repository<Asset>;
  let positionService: PositionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn().mockResolvedValue([mockTransaction]),
            findOne: jest.fn().mockResolvedValue(mockTransaction),
            create: jest.fn().mockReturnValue(mockTransaction),
            save: jest.fn().mockResolvedValue(mockTransaction),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
              innerJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockTransaction]),
              getOne: jest.fn().mockResolvedValue(mockTransaction),
            }),
          },
        },
        {
          provide: getRepositoryToken(Asset),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              innerJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(mockTransaction.asset),
            }),
          },
        },
        {
          provide: PositionService,
          useValue: {
            calculate: jest.fn().mockReturnValue({ quantity: 20, avgCost: 100 }),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    assetRepo = module.get<Repository<Asset>>(getRepositoryToken(Asset));
    positionService = module.get<PositionService>(PositionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return transactions list', async () => {
      const result = await service.findAll('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return single transaction', async () => {
      const result = await service.findOne('tx-1', 'user-1');
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if not found', async () => {
      const qb = transactionRepo.createQueryBuilder();
      jest.spyOn(qb, 'getOne').mockResolvedValue(null);
      jest.spyOn(transactionRepo, 'createQueryBuilder').mockReturnValue(qb);

      await expect(service.findOne('invalid-tx', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and save buy transaction', async () => {
      const result = await service.create('user-1', 'asset-1', 'buy', 5, 100, 2, '2026-01-01');
      expect(result).toBeDefined();
      expect(transactionRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if asset not owned or exists', async () => {
      const assetQb = assetRepo.createQueryBuilder();
      jest.spyOn(assetQb, 'getOne').mockResolvedValue(null);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(assetQb);

      await expect(service.create('user-1', 'invalid-asset', 'buy', 5, 100, 2, '')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map deposit side correctly and save for deposit asset type', async () => {
      const depositAsset = {
        id: 'asset-2',
        type: 'deposit',
        portfolio: { id: 'port-1', userId: 'user-1' },
      };
      const assetQb = assetRepo.createQueryBuilder();
      jest.spyOn(assetQb, 'getOne').mockResolvedValue(depositAsset as any);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(assetQb);

      const result = await service.create('user-1', 'asset-2', 'deposit', 500, 1, 0, '');
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if side is invalid for deposit asset', async () => {
      const depositAsset = {
        id: 'asset-2',
        type: 'deposit',
        portfolio: { id: 'port-1', userId: 'user-1' },
      };
      const assetQb = assetRepo.createQueryBuilder();
      jest.spyOn(assetQb, 'getOne').mockResolvedValue(depositAsset as any);
      jest.spyOn(assetRepo, 'createQueryBuilder').mockReturnValue(assetQb);

      await expect(service.create('user-1', 'asset-2', 'invalid' as any, 500, 1, 0, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if selling more than current quantity', async () => {
      jest.spyOn(positionService, 'calculate').mockReturnValue({ quantity: 2, avgCost: 100, realizedPnl: 0, totalCost: 200 });
      await expect(service.create('user-1', 'asset-1', 'sell', 5, 200, 0, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should successfully update and return the transaction', async () => {
      const result = await service.update('tx-1', 'user-1', 'asset-1', 'buy', 5, 150, 2, '2026-01-01');
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException on sell update exceeding holdings limit', async () => {
      jest.spyOn(positionService, 'calculate').mockReturnValue({ quantity: 2, avgCost: 100, realizedPnl: 0, totalCost: 200 });
      await expect(service.update('tx-1', 'user-1', 'asset-1', 'sell', 10, 150, 2, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should successfully remove transaction', async () => {
      await service.remove('tx-1', 'user-1');
      expect(transactionRepo.delete).toHaveBeenCalledWith('tx-1');
    });
  });
});
