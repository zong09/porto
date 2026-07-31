import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(BackupService.name);

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

  private asArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
  }

  /**
   * Reads a record's original id, which is only ever used as a lookup key for
   * the old->new maps below. It never reaches the database.
   */
  private takeOldId(item: any): string {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) {
      throw new BadRequestException('ข้อมูลในไฟล์ Backup ไม่ถูกต้อง');
    }
    return item.id;
  }

  /**
   * Strips every client-supplied identity vector from a backup record: the
   * primary key, plus any relation object that could smuggle a foreign key past
   * the explicit FK assignment at the call site. Unrecognised extra properties
   * are left alone — TypeORM ignores anything that isn't a mapped column, and
   * keeping them means a column added later still round-trips.
   */
  private stripIdentity(item: any, relations: string[]): Record<string, any> {
    const clone = { ...item };
    delete clone.id;
    for (const relation of relations) {
      delete clone[relation];
    }
    return clone;
  }

  /**
   * Resolves a child's foreign key through its parent's old->new id map. A key
   * that wasn't in the file points at a row this import never created — a
   * corrupt backup, or an attempt to write into another user's data — so it is
   * rejected rather than trusted.
   */
  private remapForeignKey(idMap: Map<string, string>, oldId: unknown): string {
    const mapped = typeof oldId === 'string' ? idMap.get(oldId) : undefined;
    if (!mapped) {
      throw new BadRequestException(
        'ข้อมูลในไฟล์ Backup ไม่สอดคล้องกัน (อ้างอิงข้อมูลที่ไม่มีอยู่ในไฟล์)',
      );
    }
    return mapped;
  }

  async exportData(userId: string, password: string): Promise<Buffer> {
    // Fetch all user data
    const portfolios = await this.portfolioRepo.find({ where: { userId } });
    const portfolioIds = portfolios.map((p) => p.id);

    let assets: Asset[] = [];
    if (portfolioIds.length > 0) {
      assets = await this.assetRepo
        .createQueryBuilder('asset')
        .where('asset.portfolioId IN (:...portfolioIds)', { portfolioIds })
        .getMany();
    }

    const assetIds = assets.map((a) => a.id);
    let transactions: Transaction[] = [];
    if (assetIds.length > 0) {
      transactions = await this.transactionRepo
        .createQueryBuilder('tx')
        .where('tx.assetId IN (:...assetIds)', { assetIds })
        .getMany();
    }

    const liabilities = await this.liabilityRepo.find({ where: { userId } });
    const liabilityIds = liabilities.map((l) => l.id);

    let liabilityTransactions: LiabilityTransaction[] = [];
    if (liabilityIds.length > 0) {
      liabilityTransactions = await this.liabilityTxRepo
        .createQueryBuilder('ltx')
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
      },
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

  async importData(
    userId: string,
    backupBuffer: Buffer,
    password: string,
  ): Promise<void> {
    this.logger.log(`Backup import started userId=${userId}`);

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
      throw new BadRequestException(
        'รหัสผ่านไม่ถูกต้อง หรือไฟล์ Backup เสียหาย',
      );
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

      // 2. Insert new data under freshly generated ids.
      //
      // Every id in the file is client-supplied, so none of it can be trusted.
      // manager.save() given a populated primary key issues an UPDATE with no
      // userId predicate, so preserving ids would let a crafted — or merely
      // shared — backup retarget another user's rows to the importer. Assets in
      // particular have no userId column at all: their tenancy is derived
      // entirely from portfolioId, so an unvalidated portfolioId writes straight
      // into someone else's portfolio.
      //
      // Parents therefore get new ids, and each child's foreign key is rewritten
      // through its parent's old->new map. A portfolioId/assetId/liabilityId
      // that isn't in this file can never reach the database.
      const portfolioIdMap = new Map<string, string>();
      const assetIdMap = new Map<string, string>();
      const liabilityIdMap = new Map<string, string>();

      // NetWorthHistory has no children. @Unique(['userId', 'date']) means a
      // file carrying the same date twice would now collide instead of quietly
      // UPDATE-ing over itself, so keep the last entry per date.
      const historyByDate = new Map<string, Record<string, any>>();
      for (const item of this.asArray(netWorthHistory)) {
        const row = this.stripIdentity(item, ['user']);
        historyByDate.set(String(row.date), {
          ...row,
          id: crypto.randomUUID(),
          userId,
        });
      }
      if (historyByDate.size > 0) {
        await queryRunner.manager.save(NetWorthHistory, [
          ...historyByDate.values(),
        ]);
      }

      // Insert Portfolios (parent of Asset)
      const portfolioRows = this.asArray(portfolios).map((item: any) => {
        const id = crypto.randomUUID();
        portfolioIdMap.set(this.takeOldId(item), id);
        return { ...this.stripIdentity(item, ['user', 'assets']), id, userId };
      });
      if (portfolioRows.length > 0) {
        await queryRunner.manager.save(Portfolio, portfolioRows);
      }

      // Insert Assets (parent of Transaction) — portfolioId remapped
      const assetRows = this.asArray(assets).map((item: any) => {
        const id = crypto.randomUUID();
        assetIdMap.set(this.takeOldId(item), id);
        return {
          ...this.stripIdentity(item, ['portfolio', 'transactions']),
          id,
          portfolioId: this.remapForeignKey(portfolioIdMap, item.portfolioId),
        };
      });
      if (assetRows.length > 0) {
        await queryRunner.manager.save(Asset, assetRows);
      }

      // Insert Transactions — assetId remapped
      const transactionRows = this.asArray(transactions).map((item: any) => ({
        ...this.stripIdentity(item, ['asset']),
        id: crypto.randomUUID(),
        assetId: this.remapForeignKey(assetIdMap, item.assetId),
      }));
      if (transactionRows.length > 0) {
        await queryRunner.manager.save(Transaction, transactionRows);
      }

      // Insert Liabilities (parent of LiabilityTransaction)
      const liabilityRows = this.asArray(liabilities).map((item: any) => {
        const id = crypto.randomUUID();
        liabilityIdMap.set(this.takeOldId(item), id);
        return { ...this.stripIdentity(item, ['user']), id, userId };
      });
      if (liabilityRows.length > 0) {
        await queryRunner.manager.save(Liability, liabilityRows);
      }

      // Insert LiabilityTransactions — liabilityId remapped
      const liabilityTxRows = this.asArray(liabilityTransactions).map(
        (item: any) => ({
          ...this.stripIdentity(item, ['liability']),
          id: crypto.randomUUID(),
          userId,
          liabilityId: this.remapForeignKey(liabilityIdMap, item.liabilityId),
        }),
      );
      if (liabilityTxRows.length > 0) {
        await queryRunner.manager.save(LiabilityTransaction, liabilityTxRows);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Backup import complete userId=${userId} portfolios=${portfolioRows.length} ` +
          `assets=${assetRows.length} transactions=${transactionRows.length} ` +
          `liabilities=${liabilityRows.length} liabilityTransactions=${liabilityTxRows.length} ` +
          `netWorthHistory=${historyByDate.size}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // The raw driver message leaks table, column and constraint names and
      // doubles as an existence oracle for guessed ids — log it, never return it.
      this.logger.error(
        `Backup import failed userId=${userId}: ${error?.message}`,
        error?.stack,
      );
      // Our own validation errors already carry a safe, useful message.
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('เกิดข้อผิดพลาดในการกู้คืนข้อมูล');
    } finally {
      await queryRunner.release();
    }
  }
}
