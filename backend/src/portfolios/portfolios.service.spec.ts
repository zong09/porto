import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfoliosService } from './portfolios.service';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPortfolio = {
  id: 'portfolio-1',
  userId: 'user-1',
  name: 'Stocks Portfolio',
  color: 0,
  sortOrder: 0,
};

describe('PortfoliosService', () => {
  let service: PortfoliosService;
  let portfolioRepo: Repository<Portfolio>;
  let assetRepo: Repository<Asset>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfoliosService,
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            find: jest.fn().mockResolvedValue([mockPortfolio]),
            findOne: jest.fn().mockResolvedValue(mockPortfolio),
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockReturnValue(mockPortfolio),
            save: jest.fn().mockResolvedValue(mockPortfolio),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(Asset),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<PortfoliosService>(PortfoliosService);
    portfolioRepo = module.get<Repository<Portfolio>>(
      getRepositoryToken(Portfolio),
    );
    assetRepo = module.get<Repository<Asset>>(getRepositoryToken(Asset));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all portfolios of user sorted', async () => {
      const result = await service.findAll('user-1');
      expect(result).toEqual([mockPortfolio]);
      expect(portfolioRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a portfolio by ID and userId', async () => {
      const result = await service.findOne('portfolio-1', 'user-1');
      expect(result).toEqual(mockPortfolio);
      expect(portfolioRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'portfolio-1', userId: 'user-1' },
      });
    });

    it('should throw NotFoundException if portfolio not found', async () => {
      jest.spyOn(portfolioRepo, 'findOne').mockResolvedValue(null);
      await expect(service.findOne('invalid-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and save a new portfolio', async () => {
      const result = await service.create('user-1', 'New Port', 2);
      expect(result).toBeDefined();
      expect(portfolioRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'New Port',
        color: 2,
        sortOrder: 1,
      });
      expect(portfolioRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and save the portfolio', async () => {
      const result = await service.update(
        'portfolio-1',
        'user-1',
        'Updated Port',
        3,
      );
      expect(result).toBeDefined();
      expect(portfolioRepo.save).toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('should successfully reorder portfolios', async () => {
      const ids = ['portfolio-1'];
      await service.reorder('user-1', ids);
      expect(portfolioRepo.update).toHaveBeenCalledWith(
        { id: 'portfolio-1', userId: 'user-1' },
        { sortOrder: 0 },
      );
    });

    it('should throw BadRequestException if portfolio ID does not belong to user', async () => {
      const ids = ['portfolio-invalid'];
      await expect(service.reorder('user-1', ids)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete portfolio if it has no assets', async () => {
      await service.remove('portfolio-1', 'user-1');
      expect(portfolioRepo.delete).toHaveBeenCalledWith({
        id: 'portfolio-1',
        userId: 'user-1',
      });
    });

    it('should throw BadRequestException if portfolio contains assets', async () => {
      jest.spyOn(assetRepo, 'count').mockResolvedValue(1);
      await expect(service.remove('portfolio-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
