import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

import { BackupService } from './backup.service';
import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Liability } from '../liabilities/entities/liability.entity';
import { LiabilityTransaction } from '../liabilities/entities/liability-transaction.entity';
import { NetWorthHistory } from '../net-worth/entities/net-worth-history.entity';

const PASSWORD = 'correct-horse-battery';
const ATTACKER = 'attacker-user-id';

// Rows belonging to a different tenant. Nothing the import writes may ever
// reference these ids.
const VICTIM_PORTFOLIO_ID = 'victim-portfolio-uuid';
const VICTIM_ASSET_ID = 'victim-asset-uuid';
const VICTIM_LIABILITY_ID = 'victim-liability-uuid';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds a backup blob in the exact envelope importData expects
 * (salt 32B | iv 12B | authTag 16B | ciphertext). Any account holder can do
 * this: exportData hands them a file encrypted under a password they chose
 * whose plaintext they already know, so the encryption is a file-integrity
 * measure, not an authorization boundary. The tests below rely on that.
 */
function sealBackup(data: any, password = PASSWORD, version = 1): Buffer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ version, timestamp: '2026-07-31', data }), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]);
}

/** A self-consistent, entirely legitimate backup of one user's own data. */
function legitBackup() {
  return {
    portfolios: [
      { id: 'p1', name: 'Crypto', color: 1, sortOrder: 0, userId: 'original-owner' },
      { id: 'p2', name: 'Stocks', color: 2, sortOrder: 1, userId: 'original-owner' },
    ],
    assets: [
      { id: 'a1', portfolioId: 'p1', type: 'crypto', symbol: 'BTC', name: 'Bitcoin', currency: 'USD' },
      { id: 'a2', portfolioId: 'p2', type: 'us', symbol: 'VOO', name: 'Vanguard', currency: 'USD' },
    ],
    transactions: [
      { id: 't1', assetId: 'a1', side: 'buy', quantity: 0.5, price: 60000, fee: 10, date: '2026-01-02' },
      { id: 't2', assetId: 'a2', side: 'buy', quantity: 3, price: 500, fee: 1, date: '2026-02-03' },
    ],
    liabilities: [
      { id: 'l1', name: 'Mortgage', amount: 1000, currency: 'THB', userId: 'original-owner' },
    ],
    liabilityTransactions: [
      { id: 'lt1', liabilityId: 'l1', type: 'pay', amount: 100, date: '2026-03-04', userId: 'original-owner' },
    ],
    netWorthHistory: [
      { id: 'h1', date: '2026-01-01', totalAssetsThb: 100, totalLiabilitiesThb: 10, netWorthThb: 90, fxRate: 35, userId: 'original-owner' },
    ],
  };
}

describe('BackupService', () => {
  let service: BackupService;
  let saved: Map<any, any[]>;
  let queryRunner: any;

  const rowsFor = (entity: any): any[] => saved.get(entity) ?? [];

  beforeEach(async () => {
    saved = new Map();
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
        save: jest.fn((entity: any, rows: any[]) => {
          saved.set(entity, [...(saved.get(entity) ?? []), ...rows]);
          return Promise.resolve(rows);
        }),
      },
    };

    const repoMock = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: getRepositoryToken(Portfolio), useValue: repoMock },
        { provide: getRepositoryToken(Asset), useValue: repoMock },
        { provide: getRepositoryToken(Transaction), useValue: repoMock },
        { provide: getRepositoryToken(Liability), useValue: repoMock },
        { provide: getRepositoryToken(LiabilityTransaction), useValue: repoMock },
        { provide: getRepositoryToken(NetWorthHistory), useValue: repoMock },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn(() => queryRunner) },
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('importData — cross-tenant isolation', () => {
    it('never writes a client-supplied primary key, so a victim row cannot be UPDATE-ed', async () => {
      // save() with a populated PK issues an UPDATE with no userId predicate.
      // Here the file claims the victim's portfolio/liability/history ids.
      const data = legitBackup();
      data.portfolios[0].id = VICTIM_PORTFOLIO_ID;
      data.assets[0].portfolioId = VICTIM_PORTFOLIO_ID;
      data.liabilities[0].id = VICTIM_LIABILITY_ID;
      data.liabilityTransactions[0].liabilityId = VICTIM_LIABILITY_ID;

      await service.importData(ATTACKER, sealBackup(data), PASSWORD);

      const allIds = [...saved.values()].flat().map((r) => r.id);
      expect(allIds.length).toBeGreaterThan(0);
      expect(allIds).not.toContain(VICTIM_PORTFOLIO_ID);
      expect(allIds).not.toContain(VICTIM_LIABILITY_ID);
      // Nothing keeps a file-supplied id at all — every id is freshly generated.
      for (const id of allIds) {
        expect(id).toMatch(UUID_RE);
      }
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects an asset whose portfolioId is not in the file (another tenant\'s portfolio)', async () => {
      // Asset has no userId column — its tenancy comes entirely from
      // portfolioId, so this is the unconditional cross-tenant write.
      const data = legitBackup();
      data.assets[0].portfolioId = VICTIM_PORTFOLIO_ID;

      await expect(
        service.importData(ATTACKER, sealBackup(data), PASSWORD),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(rowsFor(Asset)).toHaveLength(0);
    });

    it("rejects a transaction whose assetId is not in the file (another tenant's asset)", async () => {
      const data = legitBackup();
      data.transactions[0].assetId = VICTIM_ASSET_ID;

      await expect(
        service.importData(ATTACKER, sealBackup(data), PASSWORD),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(rowsFor(Transaction)).toHaveLength(0);
    });

    it("rejects a liability transaction whose liabilityId is not in the file", async () => {
      const data = legitBackup();
      data.liabilityTransactions[0].liabilityId = VICTIM_LIABILITY_ID;

      await expect(
        service.importData(ATTACKER, sealBackup(data), PASSWORD),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(rowsFor(LiabilityTransaction)).toHaveLength(0);
    });

    it('forces userId to the caller and ignores the userId in the file', async () => {
      await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);

      for (const entity of [Portfolio, Liability, LiabilityTransaction, NetWorthHistory]) {
        const rows = rowsFor(entity);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.userId).toBe(ATTACKER);
        }
      }
    });

    it('drops relation objects that try to smuggle a foreign key past the remap', async () => {
      const data: any = legitBackup();
      data.assets[0].portfolio = { id: VICTIM_PORTFOLIO_ID, userId: 'victim' };
      data.transactions[0].asset = { id: VICTIM_ASSET_ID };
      data.liabilityTransactions[0].liability = { id: VICTIM_LIABILITY_ID };

      await service.importData(ATTACKER, sealBackup(data), PASSWORD);

      for (const row of rowsFor(Asset)) {
        expect(row.portfolio).toBeUndefined();
      }
      for (const row of rowsFor(Transaction)) {
        expect(row.asset).toBeUndefined();
      }
      for (const row of rowsFor(LiabilityTransaction)) {
        expect(row.liability).toBeUndefined();
      }
    });
  });

  describe('importData — legitimate restores stay intact', () => {
    it('rewrites every child foreign key to its newly inserted parent', async () => {
      await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);

      const portfolioIds = rowsFor(Portfolio).map((r) => r.id);
      const assetIds = rowsFor(Asset).map((r) => r.id);
      const liabilityIds = rowsFor(Liability).map((r) => r.id);

      expect(portfolioIds).toHaveLength(2);
      expect(assetIds).toHaveLength(2);

      // Stripping ids without remapping FKs would orphan every child — this is
      // the regression guard for that.
      for (const asset of rowsFor(Asset)) {
        expect(portfolioIds).toContain(asset.portfolioId);
      }
      for (const tx of rowsFor(Transaction)) {
        expect(assetIds).toContain(tx.assetId);
      }
      for (const ltx of rowsFor(LiabilityTransaction)) {
        expect(liabilityIds).toContain(ltx.liabilityId);
      }
    });

    it('preserves the two assets in distinct portfolios rather than collapsing them', async () => {
      await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);

      const assets = rowsFor(Asset);
      const bySymbol = new Map(assets.map((a) => [a.symbol, a]));
      expect(bySymbol.get('BTC')!.portfolioId).not.toBe(
        bySymbol.get('VOO')!.portfolioId,
      );
      // Non-identity fields survive untouched.
      expect(bySymbol.get('BTC')!.name).toBe('Bitcoin');
      expect(bySymbol.get('BTC')!.currency).toBe('USD');
    });

    it('inserts parents before children', async () => {
      await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);

      const order = queryRunner.manager.save.mock.calls.map((c: any[]) => c[0]);
      expect(order.indexOf(Portfolio)).toBeLessThan(order.indexOf(Asset));
      expect(order.indexOf(Asset)).toBeLessThan(order.indexOf(Transaction));
      expect(order.indexOf(Liability)).toBeLessThan(
        order.indexOf(LiabilityTransaction),
      );
    });

    it('dedupes net-worth history by date, since fresh ids turn a repeat into a unique-constraint collision', async () => {
      const data = legitBackup();
      data.netWorthHistory = [
        { id: 'h1', date: '2026-01-01', totalAssetsThb: 100, totalLiabilitiesThb: 10, netWorthThb: 90, fxRate: 35, userId: 'x' },
        { id: 'h2', date: '2026-01-01', totalAssetsThb: 200, totalLiabilitiesThb: 20, netWorthThb: 180, fxRate: 36, userId: 'x' },
      ];

      await service.importData(ATTACKER, sealBackup(data), PASSWORD);

      const history = rowsFor(NetWorthHistory);
      expect(history).toHaveLength(1);
      expect(history[0].netWorthThb).toBe(180); // last entry wins
    });

    it('clears only the caller\'s existing rows', async () => {
      await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);

      for (const call of queryRunner.manager.delete.mock.calls) {
        expect(call[1]).toEqual({ userId: ATTACKER });
      }
    });
  });

  describe('importData — error handling', () => {
    it('does not leak the raw driver message to the client', async () => {
      const driverMessage =
        'duplicate key value violates unique constraint "net_worth_history_userId_date_key"';
      queryRunner.manager.save.mockRejectedValueOnce(new Error(driverMessage));

      let caught: any;
      try {
        await service.importData(ATTACKER, sealBackup(legitBackup()), PASSWORD);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(BadRequestException);
      // Table/column/constraint names are a free schema map and an existence
      // oracle for guessed ids.
      expect(caught.message).toBe('เกิดข้อผิดพลาดในการกู้คืนข้อมูล');
      expect(caught.message).not.toContain('net_worth_history');
      expect(caught.message).not.toContain('constraint');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects a wrong password without touching the database', async () => {
      await expect(
        service.importData(ATTACKER, sealBackup(legitBackup()), 'wrong-password'),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('rejects an unsupported payload version', async () => {
      await expect(
        service.importData(ATTACKER, sealBackup(legitBackup(), PASSWORD, 2), PASSWORD),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('rejects a truncated file', async () => {
      await expect(
        service.importData(ATTACKER, Buffer.alloc(16), PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
