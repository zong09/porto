import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Liability } from './entities/liability.entity';

@Injectable()
export class LiabilitiesService {
  constructor(
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
  ) {}

  async findAll(userId: string): Promise<Liability[]> {
    return this.liabilityRepo.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Liability> {
    const liability = await this.liabilityRepo.findOne({ where: { id, userId } });
    if (!liability) {
      throw new NotFoundException('ไม่พบรายการหนี้สินนี้');
    }
    return liability;
  }

  async create(userId: string, name: string, amount: number): Promise<Liability> {
    const liability = this.liabilityRepo.create({
      userId,
      name,
      amount,
    });
    return this.liabilityRepo.save(liability);
  }

  async update(id: string, userId: string, name?: string, amount?: number): Promise<Liability> {
    const liability = await this.findOne(id, userId);
    if (name !== undefined) {
      liability.name = name;
    }
    if (amount !== undefined) {
      liability.amount = amount;
    }
    return this.liabilityRepo.save(liability);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.liabilityRepo.delete({ id, userId });
  }
}
