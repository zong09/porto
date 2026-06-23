import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';
import { JwtService } from '@nestjs/jwt';
import { SeedService } from '../seed/seed.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockUser = {
  id: 'user-1',
  email: 'test@porto.app',
  name: 'Test User',
  passwordHash: 'hashed-password',
  isDemo: false,
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Repository<User>;
  let portfolioRepo: Repository<Portfolio>;
  let liabilityRepo: Repository<Liability>;
  let netWorthHistoryRepo: Repository<NetWorthHistory>;
  let jwtService: JwtService;
  let seedService: SeedService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
            create: jest.fn().mockReturnValue(mockUser),
            save: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(Liability),
          useValue: {
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(NetWorthHistory),
          useValue: {
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-token'),
          },
        },
        {
          provide: SeedService,
          useValue: {
            seedDemoUser: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              if (key === 'ENABLE_DEMO') return 'true';
              if (key === 'ENABLE_REGISTER') return 'true';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    portfolioRepo = module.get<Repository<Portfolio>>(getRepositoryToken(Portfolio));
    liabilityRepo = module.get<Repository<Liability>>(getRepositoryToken(Liability));
    netWorthHistoryRepo = module.get<Repository<NetWorthHistory>>(getRepositoryToken(NetWorthHistory));
    jwtService = module.get<JwtService>(JwtService);
    seedService = module.get<SeedService>(SeedService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('clear', () => {
    it('should delete all user portfolios, liabilities, net worth history', async () => {
      await service.clear('user-1');
      expect(portfolioRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(liabilityRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(netWorthHistoryRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('register', () => {
    it('should successfully register new user', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register('new@porto.app', 'New User', 'password');
      expect(result).toEqual({
        token: 'signed-token',
        user: {
          id: 'user-1',
          email: 'test@porto.app',
          name: 'Test User',
          isDemo: false,
        },
      });
      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already in use', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      await expect(service.register('test@porto.app', 'New User', 'password')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException if registration is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');
      await expect(service.register('test@porto.app', 'New User', 'password')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@porto.app', 'password');
      expect(result).toBeDefined();
      expect(result.token).toBe('signed-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(service.login('test@porto.app', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password mismatch', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@porto.app', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('demo', () => {
    it('should successfully create and seed demo user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('demo-hashed-password');
      const result = await service.demo();
      expect(result).toBeDefined();
      expect(result.user.isDemo).toBe(true);
      expect(seedService.seedDemoUser).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if demo mode is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');
      await expect(service.demo()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('validateUserById', () => {
    it('should return user or null', async () => {
      const result = await service.validateUserById('user-1');
      expect(result).toEqual(mockUser);
    });
  });
});
