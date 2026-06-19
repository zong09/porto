import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';

@Injectable()
export class PortfoliosService {
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
  ) {}

  async findAll(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepo.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepo.findOne({ where: { id, userId } });
    if (!portfolio) {
      throw new NotFoundException('ไม่พบพอร์ตการลงทุนนี้');
    }
    return portfolio;
  }

  async create(userId: string, name: string, color?: number): Promise<Portfolio> {
    const count = await this.portfolioRepo.count({ where: { userId } });
    const colorIndex = color !== undefined ? color : count % 6;
    const portfolio = this.portfolioRepo.create({
      userId,
      name,
      color: colorIndex,
    });
    return this.portfolioRepo.save(portfolio);
  }

  async update(id: string, userId: string, name: string, color?: number): Promise<Portfolio> {
    const portfolio = await this.findOne(id, userId);
    portfolio.name = name;
    if (color !== undefined) {
      portfolio.color = color;
    }
    return this.portfolioRepo.save(portfolio);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    // Verify if portfolio has any assets
    const assetCount = await this.assetRepo.count({ where: { portfolioId: id } });
    if (assetCount > 0) {
      throw new BadRequestException('ไม่สามารถลบพอร์ตได้เนื่องจากยังมีสินทรัพย์เหลืออยู่ภายในพอร์ต');
    }

    await this.portfolioRepo.delete({ id, userId });
  }
}
