import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';

import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { LiabilityTransaction } from '../liabilities/entities/liability-transaction.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';

@Injectable()
export class BackupService {
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepo: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Liability)
    private liabilityRepo: Repository<Liability>,
    @InjectRepository(LiabilityTransaction)
    private liabilityTxRepo: Repository<LiabilityTransaction>,
    @InjectRepository(NetWorthHistory)
    private netWorthRepo: Repository<NetWorthHistory>,
    private dataSource: DataSource,
  ) {}

  private deriveKey(password: string, salt: Buffer): Buffer {
    // 256 bits = 32 bytes key for AES-256-GCM
    return crypto.scryptSync(password, salt, 32);
  }

  async exportData(userId: string, password: string): Promise<Buffer> {
    // Fetch all user data
    const portfolios = await this.portfolioRepo.find({ where: { userId } });
    const portfolioIds = portfolios.map((p) => p.id);
    
    let assets: Asset[] = [];
    if (portfolioIds.length > 0) {
      assets = await this.assetRepo.createQueryBuilder('asset')
        .where('asset.portfolioId IN (:...portfolioIds)', { portfolioIds })
        .getMany();
    }
    
    const assetIds = assets.map((a) => a.id);
    let transactions: Transaction[] = [];
    if (assetIds.length > 0) {
      transactions = await this.transactionRepo.createQueryBuilder('tx')
        .where('tx.assetId IN (:...assetIds)', { assetIds })
        .getMany();
    }

    const liabilities = await this.liabilityRepo.find({ where: { userId } });
    const liabilityIds = liabilities.map((l) => l.id);
    
    let liabilityTransactions: LiabilityTransaction[] = [];
    if (liabilityIds.length > 0) {
      liabilityTransactions = await this.liabilityTxRepo.createQueryBuilder('ltx')
        .where('ltx.liabilityId IN (:...liabilityIds)', { liabilityIds })
        .getMany();
    }

    const netWorthHistory = await this.netWorthRepo.find({ where: { userId } });

    // Prepare payload
    const payload = JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        portfolios,
        assets,
        transactions,
        liabilities,
        liabilityTransactions,
        netWorthHistory,
      }
    });

    // Encrypt payload
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey(password, salt);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(payload, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: salt (32B) + iv (12B) + authTag (16B) + encrypted_data
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result;
  }

  async importData(userId: string, backupBuffer: Buffer, password: string): Promise<void> {
    if (backupBuffer.length < 32 + 12 + 16) {
      throw new BadRequestException('รูปแบบไฟล์ Backup ไม่ถูกต้อง');
    }

    // Extract parts
    const salt = backupBuffer.subarray(0, 32);
    const iv = backupBuffer.subarray(32, 44);
    const authTag = backupBuffer.subarray(44, 60);
    const encrypted = backupBuffer.subarray(60);

    let decryptedData: string;
    try {
      const key = this.deriveKey(password, salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      decryptedData = decrypted.toString('utf8');
    } catch (error) {
      throw new BadRequestException('รหัสผ่านไม่ถูกต้อง หรือไฟล์ Backup เสียหาย');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(decryptedData);
    } catch (error) {
      throw new BadRequestException('ข้อมูลในไฟล์ Backup ไม่ถูกต้อง');
    }

    if (!parsed || parsed.version !== 1 || !parsed.data) {
      throw new BadRequestException('รูปแบบข้อมูล Backup ไม่รองรับ');
    }

    const {
      portfolios,
      assets,
      transactions,
      liabilities,
      liabilityTransactions,
      netWorthHistory,
    } = parsed.data;

    // Use transaction to ensure full restore or rollback
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Clear existing data
      // Due to CASCADE, deleting portfolios will delete assets and transactions
      await queryRunner.manager.delete(Portfolio, { userId });
      // Delete liabilities, will delete liability transactions
      await queryRunner.manager.delete(Liability, { userId });
      await queryRunner.manager.delete(NetWorthHistory, { userId });

      // 2. Insert new data
      // Insert NetWorthHistory
      if (netWorthHistory && netWorthHistory.length > 0) {
        // override userId to match current user, just in case they import to another account
        const data = netWorthHistory.map((item: any) => ({ ...item, userId }));
        await queryRunner.manager.save(NetWorthHistory, data);
      }

      // Insert Portfolios
      if (portfolios && portfolios.length > 0) {
        const data = portfolios.map((item: any) => ({ ...item, userId }));
        await queryRunner.manager.save(Portfolio, data);
      }

      // Insert Assets
      if (assets && assets.length > 0) {
        await queryRunner.manager.save(Asset, assets);
      }

      // Insert Transactions
      if (transactions && transactions.length > 0) {
        await queryRunner.manager.save(Transaction, transactions);
      }

      // Insert Liabilities
      if (liabilities && liabilities.length > 0) {
        const data = liabilities.map((item: any) => ({ ...item, userId }));
        await queryRunner.manager.save(Liability, data);
      }

      // Insert LiabilityTransactions
      if (liabilityTransactions && liabilityTransactions.length > 0) {
        const data = liabilityTransactions.map((item: any) => ({ ...item, userId }));
        await queryRunner.manager.save(LiabilityTransaction, data);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('เกิดข้อผิดพลาดในการกู้คืนข้อมูล: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }
}
