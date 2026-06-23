import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiabilitiesService } from './liabilities.service';
import { Liability } from './entities/liability.entity';
import { NotFoundException } from '@nestjs/common';

const mockLiability = {
  id: 'uuid-1',
  userId: 'user-1',
  name: 'Car Loan',
  amount: 500000,
};

describe('LiabilitiesService', () => {
  let service: LiabilitiesService;
  let repo: Repository<Liability>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiabilitiesService,
        {
          provide: getRepositoryToken(Liability),
          useValue: {
            find: jest.fn().mockResolvedValue([mockLiability]),
            findOne: jest.fn().mockResolvedValue(mockLiability),
            create: jest.fn().mockReturnValue(mockLiability),
            save: jest.fn().mockResolvedValue(mockLiability),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<LiabilitiesService>(LiabilitiesService);
    repo = module.get<Repository<Liability>>(getRepositoryToken(Liability));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all liabilities of user', async () => {
      const result = await service.findAll('user-1');
      expect(result).toEqual([mockLiability]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single liability', async () => {
      const result = await service.findOne('uuid-1', 'user-1');
      expect(result).toEqual(mockLiability);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1', userId: 'user-1' },
      });
    });

    it('should throw NotFoundException if liability not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.findOne('invalid-uuid', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should successfully create and return a liability', async () => {
      const newLiabilityData = { name: 'Student Loan', amount: 100000 };
      const createdLiability = {
        id: 'uuid-2',
        userId: 'user-1',
        ...newLiabilityData,
      };

      jest.spyOn(repo, 'create').mockReturnValue(createdLiability as any);
      jest.spyOn(repo, 'save').mockResolvedValue(createdLiability as any);

      const result = await service.create('user-1', 'Student Loan', 100000);
      expect(result).toEqual(createdLiability);
      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Student Loan',
        amount: 100000,
      });
      expect(repo.save).toHaveBeenCalledWith(createdLiability);
    });
  });

  describe('update', () => {
    it('should successfully update and return the liability', async () => {
      const updatedLiability = {
        ...mockLiability,
        name: 'Car Loan Updated',
        amount: 450000,
      };

      jest.spyOn(repo, 'save').mockResolvedValue(updatedLiability as any);

      const result = await service.update('uuid-1', 'user-1', 'Car Loan Updated', 450000);
      expect(result).toEqual(updatedLiability);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should successfully delete a liability', async () => {
      const deleteSpy = jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1 } as any);
      await service.remove('uuid-1', 'user-1');
      expect(deleteSpy).toHaveBeenCalledWith({ id: 'uuid-1', userId: 'user-1' });
    });
  });
});
