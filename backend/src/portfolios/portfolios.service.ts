import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
  ) {}

  async findAll(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepo.find({
      where: { userId },
      order: { sortOrder: 'ASC', name: 'ASC' },
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
    this.logger.log(`Creating portfolio name="${name}" for user=${userId}`);
    const count = await this.portfolioRepo.count({ where: { userId } });
    const colorIndex = color !== undefined ? color : count % 6;
    const portfolio = this.portfolioRepo.create({
      userId,
      name,
      color: colorIndex,
      sortOrder: count,
    });
    const saved = await this.portfolioRepo.save(portfolio);
    this.logger.log(`Portfolio created id=${saved.id} name="${name}"`);
    return saved;
  }

  async update(id: string, userId: string, name: string, color?: number): Promise<Portfolio> {
    this.logger.log(`Updating portfolio id=${id} name="${name}"`);
    const portfolio = await this.findOne(id, userId);
    portfolio.name = name;
    if (color !== undefined) {
      portfolio.color = color;
    }
    const saved = await this.portfolioRepo.save(portfolio);
    this.logger.log(`Portfolio updated successfully id=${id}`);
    return saved;
  }

  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    this.logger.log(`Reordering ${orderedIds.length} portfolios for user=${userId}`);
    // Verify all IDs belong to this user
    const portfolios = await this.portfolioRepo.find({ where: { userId } });
    const userIds = new Set(portfolios.map((p) => p.id));
    for (const id of orderedIds) {
      if (!userIds.has(id)) {
        throw new BadRequestException('พอร์ตบางรายการไม่ถูกต้อง');
      }
    }

    // Bulk update sortOrder
    const updates = orderedIds.map((id, index) =>
      this.portfolioRepo.update({ id, userId }, { sortOrder: index }),
    );
    await Promise.all(updates);
    this.logger.log(`Successfully reordered ${orderedIds.length} portfolios for user=${userId}`);
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting portfolio id=${id} for user=${userId}`);
    await this.findOne(id, userId);

    // Verify if portfolio has any assets
    const assetCount = await this.assetRepo.count({ where: { portfolioId: id } });
    if (assetCount > 0) {
      throw new BadRequestException('ไม่สามารถลบพอร์ตได้เนื่องจากยังมีสินทรัพย์เหลืออยู่ภายในพอร์ต');
    }

    await this.portfolioRepo.delete({ id, userId });
    this.logger.log(`Portfolio deleted id=${id}`);
  }
}
