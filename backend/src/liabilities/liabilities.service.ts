import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Liability } from './entities/liability.entity';
import { LiabilityTransaction } from './entities/liability-transaction.entity';

@Injectable()
export class LiabilitiesService {
  private readonly logger = new Logger(LiabilitiesService.name);
  constructor(
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
    @InjectRepository(LiabilityTransaction)
    private liabilityTxRepo: Repository<LiabilityTransaction>,
  ) {}

  async findAll(userId: string): Promise<Liability[]> {
    return this.liabilityRepo.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Liability> {
    const liability = await this.liabilityRepo.findOne({
      where: { id, userId },
    });
    if (!liability) {
      throw new NotFoundException('ไม่พบรายการหนี้สินนี้');
    }
    return liability;
  }

  async create(
    userId: string,
    name: string,
    amount: number,
    currency?: string,
  ): Promise<Liability> {
    this.logger.log(
      `Creating liability name="${name}" amount=${amount} currency=${currency} for user=${userId}`,
    );
    const liability = this.liabilityRepo.create({
      userId,
      name,
      amount,
      currency: currency || 'THB',
    });
    const saved = await this.liabilityRepo.save(liability);
    this.logger.log(`Liability created id=${saved.id} name="${name}"`);
    return saved;
  }

  async update(
    id: string,
    userId: string,
    name?: string,
    amount?: number,
    currency?: string,
  ): Promise<Liability> {
    this.logger.log(`Updating liability id=${id}`);
    const liability = await this.findOne(id, userId);
    if (name !== undefined) {
      liability.name = name;
    }
    if (amount !== undefined) {
      liability.amount = amount;
    }
    if (currency !== undefined) {
      liability.currency = currency;
    }
    const saved = await this.liabilityRepo.save(liability);
    this.logger.log(`Liability updated successfully id=${id}`);
    return saved;
  }

  async adjust(
    id: string,
    userId: string,
    type: 'pay' | 'add',
    amount: number,
    date: string,
  ): Promise<Liability> {
    this.logger.log(
      `Adjusting liability id=${id} type=${type} amount=${amount}`,
    );
    if (amount <= 0) {
      throw new BadRequestException('จำนวนเงินต้องมากกว่า 0');
    }
    const liability = await this.findOne(id, userId);
    const next =
      type === 'pay'
        ? Number(liability.amount) - amount
        : Number(liability.amount) + amount;
    liability.amount = Math.max(0, next);
    const tx = this.liabilityTxRepo.create({
      userId,
      liabilityId: id,
      type,
      amount,
      date,
    });
    await this.liabilityTxRepo.save(tx);
    const saved = await this.liabilityRepo.save(liability);
    this.logger.log(`Liability adjusted id=${id} newAmount=${saved.amount}`);
    return saved;
  }

  async findTransactions(userId: string): Promise<LiabilityTransaction[]> {
    return this.liabilityTxRepo.find({
      where: { userId },
      relations: { liability: true },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting liability id=${id} for user=${userId}`);
    await this.findOne(id, userId);
    await this.liabilityRepo.delete({ id, userId });
    this.logger.log(`Liability deleted id=${id}`);
  }
}
