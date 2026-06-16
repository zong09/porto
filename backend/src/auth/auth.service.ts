import { Injectable, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';
import { SeedService } from '../seed/seed.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
    @InjectRepository(NetWorthHistory)
    private netWorthHistoryRepo: Repository<NetWorthHistory>,
    private jwtService: JwtService,
    private seedService: SeedService,
    private configService: ConfigService,
  ) {}

  async clear(userId: string): Promise<void> {
    // Portfolios cascade delete assets and transactions
    await this.portfolioRepo.delete({ userId });
    await this.liabilityRepo.delete({ userId });
    await this.netWorthHistoryRepo.delete({ userId });
  }

  async register(email: string, name: string, pass: string) {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const passwordHash = await bcrypt.hash(pass, 10);
    const user = this.userRepo.create({
      email,
      name,
      passwordHash,
      isDemo: false,
    });
    const saved = await this.userRepo.save(user);

    return this.generateAuthResponse(saved);
  }

  async login(email: string, pass: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    return this.generateAuthResponse(user);
  }

  isDemoEnabled(): boolean {
    return this.configService.get<string>('ENABLE_DEMO', 'false') === 'true';
  }

  async demo() {
    if (!this.isDemoEnabled()) {
      throw new ForbiddenException('ฟังก์ชันเดโมถูกปิดใช้งาน');
    }

    // Generate an isolated demo user
    const randomId = Math.random().toString(36).substring(2, 8);
    const email = `demo-${randomId}@porto.app`;
    const name = `ผู้ใช้เดโม ${randomId}`;
    const passwordHash = await bcrypt.hash('demo-password', 10);

    const user = this.userRepo.create({
      email,
      name,
      passwordHash,
      isDemo: true,
    });
    const saved = await this.userRepo.save(user);

    // Seed data
    await this.seedService.seedDemoUser(saved.id);

    // Sign JWT with 24 hours expiry for demo
    const payload = { sub: saved.id, email: saved.email, name: saved.name, isDemo: true };
    const token = await this.jwtService.signAsync(payload, { expiresIn: '24h' });

    return {
      token,
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        isDemo: true,
      },
    };
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  private async generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, name: user.name, isDemo: user.isDemo };
    const token = await this.jwtService.signAsync(payload);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isDemo: user.isDemo,
      },
    };
  }
}
