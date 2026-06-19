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
      { side: 'buy', quantity: 0.2, price: 2350000, fee: 100, date: '2026-01-01' },
      { side: 'buy', quantity: 0.1, price: 2400000, fee: 50, date: '2026-01-02' },
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBeCloseTo(0.3, 8);
    // totalCost = (0.2 * 2350000 + 100) + (0.1 * 2400000 + 50) = 470100 + 240050 = 710150
    // avgCost = 710150 / 0.3 = 2367166.66666667
    expect(res.totalCost).toBe(710150);
    expect(res.avgCost).toBeCloseTo(2367166.67, 2);
    expect(res.realizedPnl).toBe(0);
  });

  it('should compute sell and realized P&L correctly', () => {
    const txs: SimpleTransaction[] = [
      { side: 'buy', quantity: 0.2, price: 2350000, fee: 0, date: '2026-01-01' }, // total cost = 470000, qty = 0.2
      { side: 'sell', quantity: 0.05, price: 3300000, fee: 0, date: '2026-01-02' }, // avgCost before = 2350000, P&L = 0.05 * (3300000 - 2350000) = 47500
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBeCloseTo(0.15, 8);
    expect(res.avgCost).toBeCloseTo(2350000, 2);
    expect(res.totalCost).toBeCloseTo(0.15 * 2350000, 2);
    expect(res.realizedPnl).toBeCloseTo(47500, 2);
  });

  it('should handle deposit and withdraw transactions correctly', () => {
    const txs: SimpleTransaction[] = [
      { side: 'deposit', quantity: 10000, price: 1, fee: 0, date: '2026-01-01' },
      { side: 'withdraw', quantity: 4000, price: 1, fee: 10, date: '2026-01-02' },
    ];
    const res = service.calculate(txs);
    expect(res.quantity).toBe(6000);
    expect(res.realizedPnl).toBe(-10); // realized pnl is negative because of the fee
  });
});
