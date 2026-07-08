import { Test, TestingModule } from '@nestjs/testing';
import { PositionService, SimpleTransaction } from './position.service';

describe('PositionService', () => {
  let service: PositionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PositionService],
    }).compile();

    service = module.get<PositionService>(PositionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compute buys correctly', () => {
    const txs: SimpleTransaction[] = [
      {
        side: 'buy',
        quantity: 0.2,
        price: 2350000,
        fee: 100,
        date: '2026-01-01',
      },
      {
        side: 'buy',
        quantity: 0.1,
        price: 2400000,
        fee: 50,
        date: '2026-01-02',
      },
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBeCloseTo(0.3, 8);
    // totalCost = (0.2 * 2350000 + 100) + (0.1 * 2400000 + 50) = 470100 + 240050 = 710150
    // avgCost = 710150 / 0.3 = 2367166.66666667
    expect(res.totalCost).toBe(710150);
    expect(res.avgCost).toBeCloseTo(2367166.67, 2);
    expect(res.realizedPnl).toBe(0);
    expect(res.direction).toBe('long');
  });

  it('should compute sell and realized P&L correctly', () => {
    const txs: SimpleTransaction[] = [
      {
        side: 'buy',
        quantity: 0.2,
        price: 2350000,
        fee: 0,
        date: '2026-01-01',
      }, // total cost = 470000, qty = 0.2
      {
        side: 'sell',
        quantity: 0.05,
        price: 3300000,
        fee: 0,
        date: '2026-01-02',
      }, // avgCost before = 2350000, P&L = 0.05 * (3300000 - 2350000) = 47500
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBeCloseTo(0.15, 8);
    expect(res.avgCost).toBeCloseTo(2350000, 2);
    expect(res.totalCost).toBeCloseTo(0.15 * 2350000, 2);
    expect(res.realizedPnl).toBeCloseTo(47500, 2);
    expect(res.direction).toBe('long');
  });

  it('should handle deposit and withdraw transactions correctly', () => {
    const txs: SimpleTransaction[] = [
      {
        side: 'deposit',
        quantity: 10000,
        price: 1,
        fee: 0,
        date: '2026-01-01',
      },
      {
        side: 'withdraw',
        quantity: 4000,
        price: 1,
        fee: 10,
        date: '2026-01-02',
      },
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBe(6000);
    expect(res.realizedPnl).toBe(-10); // realized pnl is negative because of the fee
    expect(res.direction).toBe('long');
  });

  // --- Short position tests ---

  it('should compute short sell-to-open correctly', () => {
    const txs: SimpleTransaction[] = [
      { side: 'sell', quantity: 10, price: 150, fee: 5, date: '2026-01-01' },
      { side: 'sell', quantity: 5, price: 160, fee: 3, date: '2026-01-02' },
    ];
    const res = service.calculate(txs, 'short');
    expect(res.quantity).toBeCloseTo(15, 8);
    // totalCost = (10 * 150 + 5) + (5 * 160 + 3) = 1505 + 803 = 2308
    expect(res.totalCost).toBe(2308);
    expect(res.avgCost).toBeCloseTo(2308 / 15, 2);
    expect(res.realizedPnl).toBe(0);
    expect(res.direction).toBe('short');
  });

  it('should compute short buy-to-cover with profit (price dropped)', () => {
    const txs: SimpleTransaction[] = [
      { side: 'sell', quantity: 10, price: 200, fee: 0, date: '2026-01-01' }, // Open short at 200
      { side: 'buy', quantity: 4, price: 150, fee: 0, date: '2026-01-02' }, // Cover at 150 → profit = 4 * (200 - 150) = 200
    ];
    const res = service.calculate(txs, 'short');
    expect(res.quantity).toBeCloseTo(6, 8);
    expect(res.avgCost).toBeCloseTo(200, 2);
    expect(res.realizedPnl).toBeCloseTo(200, 2); // Profit because price dropped
    expect(res.direction).toBe('short');
  });

  it('should compute short buy-to-cover with loss (price rose)', () => {
    const txs: SimpleTransaction[] = [
      { side: 'sell', quantity: 10, price: 200, fee: 0, date: '2026-01-01' }, // Open short at 200
      { side: 'buy', quantity: 4, price: 250, fee: 10, date: '2026-01-02' }, // Cover at 250 → loss = 4 * (200 - 250) - 10 = -210
    ];
    const res = service.calculate(txs, 'short');
    expect(res.quantity).toBeCloseTo(6, 8);
    expect(res.realizedPnl).toBeCloseTo(-210, 2); // Loss because price rose + fee
    expect(res.direction).toBe('short');
  });

  it('should fully close short position cleanly', () => {
    const txs: SimpleTransaction[] = [
      { side: 'sell', quantity: 5, price: 100, fee: 0, date: '2026-01-01' },
      { side: 'buy', quantity: 5, price: 80, fee: 0, date: '2026-01-02' },
    ];
    const res = service.calculate(txs, 'short');
    expect(res.quantity).toBe(0);
    expect(res.totalCost).toBe(0);
    expect(res.realizedPnl).toBeCloseTo(100, 2); // 5 * (100 - 80) = 100
    expect(res.direction).toBe('short');
  });
});
