import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Portfolio } from '../../portfolios/entities/portfolio.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export const NumericColumnTransformer = {
  to: (value: number | string | null) => value,
  from: (value: string | null) => (value ? parseFloat(value) : null),
};

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  portfolioId: string;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolioId' })
  portfolio: Portfolio;

  @Column()
  type: 'crypto' | 'th' | 'us' | 'fund' | 'deposit';

  @Column()
  symbol: string;

  @Column()
  name: string;

  @Column({ default: 'THB' })
  currency: 'THB' | 'USD';

  @Column({ nullable: true })
  cgId: string;

  @Column({ nullable: true })
  yahooSymbol: string;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    nullable: true,
    transformer: NumericColumnTransformer,
  })
  manualPrice: number | null;

  @Column({ default: 'long' })
  direction: 'long' | 'short';

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => Transaction, (transaction) => transaction.asset)
  transactions: Transaction[];
}
