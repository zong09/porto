import { Injectable } from '@nestjs/common';

export interface SimpleTransaction {
  quantity: number;
  price: number;
  fee: number;
  side: 'buy' | 'sell' | 'deposit' | 'withdraw';
  date?: string;
}

export interface PositionSummary {
  quantity: number;
  avgCost: number;
  totalCost: number;
  realizedPnl: number;
}

@Injectable()
export class PositionService {
  calculate(transactions: SimpleTransaction[]): PositionSummary {
    // Sort transactions oldest to newest by date if dates are available,
    // otherwise preserve order (we assume it's sorted)
    const sorted = [...transactions].sort((a, b) => {
      if (a.date && b.date) {
        return a.date.localeCompare(b.date);
      }
      return 0;
    });

    let quantity = 0;
    let totalCost = 0;
    let realizedPnl = 0;

    for (const tx of sorted) {
      const q = Number(tx.quantity);
      const p = Number(tx.price);
      const f = Number(tx.fee || 0);

      if (tx.side === 'buy' || tx.side === 'deposit') {
        totalCost += q * p + f;
        quantity += q;
      } else if (tx.side === 'sell' || tx.side === 'withdraw') {
        const avgCost = quantity > 0 ? totalCost / quantity : 0;
        realizedPnl += q * (p - avgCost) - f;
        totalCost -= avgCost * q;
        quantity -= q;

        // Prevent floating point errors from leaving small quantities
        if (quantity < 1e-9) {
          quantity = 0;
          totalCost = 0;
        }
      }
    }

    const avgCost = quantity > 0 ? totalCost / quantity : 0;

    return {
      quantity,
      avgCost,
      totalCost,
      realizedPnl,
    };
  }
}
