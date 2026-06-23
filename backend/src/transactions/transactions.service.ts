import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Asset } from '../assets/entities/asset.entity';
import { PositionService } from '../position/position.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
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
    this.logger.log(`Creating transaction side=${side} qty=${quantity} price=${price} asset=${assetId}`);
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

    // 3. Validate quantity does not exceed position
    // For short assets: block buy (cover) exceeding short quantity
    // For long assets: block sell exceeding held quantity
    const isShort = (asset as any).direction === 'short';
    const shouldValidate = isShort ? dbSide === 'buy' : dbSide === 'sell';

    if (shouldValidate) {
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
      const position = this.positionService.calculate(simpleTxs, isShort ? 'short' : 'long');
      
      if (quantity > position.quantity + 1e-9) {
        const msg = isShort
          ? `ไม่สามารถ cover เกินจำนวนที่ short อยู่ได้ (ปัจจุบัน short อยู่ ${position.quantity} หน่วย)`
          : `ไม่สามารถขายเกินจำนวนที่ถืออยู่ได้ (ปัจจุบันถืออยู่ ${position.quantity} หน่วย)`;
        throw new BadRequestException(msg);
      }
    }

    this.logger.log(`Transaction validated – persisting side=${dbSide} for asset=${assetId}`);
    const tx = this.transactionRepo.create({
      assetId,
      side: dbSide,
      quantity,
      price: asset.type === 'deposit' ? 1 : price,
      fee: asset.type === 'deposit' ? 0 : fee,
      date: date || new Date().toISOString().slice(0, 10),
    });

    const saved = await this.transactionRepo.save(tx);
    this.logger.log(`Transaction created successfully id=${saved.id} side=${dbSide} asset=${assetId}`);
    return saved;
  }

  async update(
    id: string,
    userId: string,
    assetId: string,
    side: 'buy' | 'sell' | 'deposit' | 'withdraw',
    quantity: number,
    price: number,
    fee: number,
    date: string,
  ): Promise<Transaction> {
    this.logger.log(`Updating transaction id=${id} side=${side} qty=${quantity} price=${price} asset=${assetId} for user=${userId}`);
    // 1. Verify transaction ownership and existence
    const tx = await this.findOne(id, userId);

    // 2. Verify asset ownership and existence
    const asset = await this.assetRepo.createQueryBuilder('asset')
      .innerJoinAndSelect('asset.portfolio', 'portfolio')
      .where('asset.id = :assetId', { assetId })
      .andWhere('portfolio.userId = :userId', { userId })
      .getOne();

    if (!asset) {
      throw new NotFoundException('ไม่พบสินทรัพย์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง');
    }

    // 3. Validate side vs asset type
    if (asset.type === 'deposit') {
      if (side !== 'buy' && side !== 'deposit' && side !== 'sell' && side !== 'withdraw') {
        throw new BadRequestException('ประเภทรายการไม่ถูกต้องสำหรับเงินฝาก');
      }
    }
    
    let dbSide: 'buy' | 'sell' = 'buy';
    if (side === 'sell' || side === 'withdraw') {
      dbSide = 'sell';
    }

    // 4. Validate quantity does not exceed position (excluding the current transaction being edited)
    const isShort = (asset as any).direction === 'short';
    const shouldValidate = isShort ? dbSide === 'buy' : dbSide === 'sell';

    if (shouldValidate) {
      const existingTxs = await this.transactionRepo.find({
        where: { assetId },
      });
      // Map to SimpleTransaction for math, excluding the current transaction being edited
      const simpleTxs = existingTxs
        .filter(t => t.id !== id)
        .map(t => ({
          quantity: Number(t.quantity),
          price: Number(t.price),
          fee: Number(t.fee),
          side: t.side,
          date: t.date,
        }));
      const position = this.positionService.calculate(simpleTxs, isShort ? 'short' : 'long');
      
      if (quantity > position.quantity + 1e-9) {
        const msg = isShort
          ? `ไม่สามารถ cover เกินจำนวนที่ short อยู่ได้ (ปัจจุบัน short อยู่ ${position.quantity} หน่วย)`
          : `ไม่สามารถขายเกินจำนวนที่ถืออยู่ได้ (ปัจจุบันถืออยู่ ${position.quantity} หน่วย)`;
        throw new BadRequestException(msg);
      }
    }

    tx.assetId = assetId;
    tx.side = dbSide;
    tx.quantity = quantity;
    tx.price = asset.type === 'deposit' ? 1 : price;
    tx.fee = asset.type === 'deposit' ? 0 : fee;
    tx.date = date || new Date().toISOString().slice(0, 10);

    const saved = await this.transactionRepo.save(tx);
    this.logger.log(`Transaction updated successfully id=${id}`);
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting transaction id=${id} for user=${userId}`);
    await this.findOne(id, userId);
    await this.transactionRepo.delete(id);
    this.logger.log(`Transaction deleted id=${id}`);
  }
}
