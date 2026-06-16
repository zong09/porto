import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Asset } from '../assets/entities/asset.entity';
import { PositionService } from '../position/position.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    private positionService: PositionService,
  ) {}

  async findAll(userId: string): Promise<Transaction[]> {
    return this.transactionRepo.createQueryBuilder('tx')
      .innerJoinAndSelect('tx.asset', 'asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .where('portfolio.userId = :userId', { userId })
      .orderBy('tx.date', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .getMany();
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const tx = await this.transactionRepo.createQueryBuilder('tx')
      .innerJoinAndSelect('tx.asset', 'asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .where('tx.id = :id', { id })
      .andWhere('portfolio.userId = :userId', { userId })
      .getOne();

    if (!tx) {
      throw new NotFoundException('ไม่พบรายการธุรกรรมนี้');
    }
    return tx;
  }

  async create(
    userId: string,
    assetId: string,
    side: 'buy' | 'sell' | 'deposit' | 'withdraw',
    quantity: number,
    price: number,
    fee: number,
    date: string,
  ): Promise<Transaction> {
    // 1. Verify asset ownership
    const asset = await this.assetRepo.createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .where('asset.id = :assetId', { assetId })
      .andWhere('portfolio.userId = :userId', { userId })
      .getOne();

    if (!asset) {
      throw new NotFoundException('ไม่พบสินทรัพย์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง');
    }

    // 2. Validate side vs asset type
    if (asset.type === 'deposit') {
      if (side !== 'buy' && side !== 'deposit' && side !== 'sell' && side !== 'withdraw') {
        throw new BadRequestException('ประเภทรายการไม่ถูกต้องสำหรับเงินฝาก');
      }
      // For deposit type in database, side should standardise to 'buy' (deposit) or 'sell' (withdraw)
      // to keep average cost math matching the design prototype.
      // In the prototype code:
      // 'buy' maps to deposit/ฝาก, 'sell' maps to withdraw/ถอน.
      // So let's map:
      // side = deposit -> buy
      // side = withdraw -> sell
    }
    
    let dbSide: 'buy' | 'sell' = 'buy';
    if (side === 'sell' || side === 'withdraw') {
      dbSide = 'sell';
    }

    // 3. For sells, validate quantity does not exceed currently held quantity
    if (dbSide === 'sell') {
      const existingTxs = await this.transactionRepo.find({
        where: { assetId },
      });
      // Map to SimpleTransaction for math
      const simpleTxs = existingTxs.map(t => ({
        quantity: Number(t.quantity),
        price: Number(t.price),
        fee: Number(t.fee),
        side: t.side,
        date: t.date,
      }));
      const position = this.positionService.calculate(simpleTxs);
      
      if (quantity > position.quantity + 1e-9) {
        throw new BadRequestException(`ไม่สามารถขายเกินจำนวนที่ถืออยู่ได้ (ปัจจุบันถืออยู่ ${position.quantity} หน่วย)`);
      }
    }

    const tx = this.transactionRepo.create({
      assetId,
      side: dbSide,
      quantity,
      price: asset.type === 'deposit' ? 1 : price,
      fee: asset.type === 'deposit' ? 0 : fee,
      date: date || new Date().toISOString().slice(0, 10),
    });

    return this.transactionRepo.save(tx);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.transactionRepo.delete(id);
  }
}
