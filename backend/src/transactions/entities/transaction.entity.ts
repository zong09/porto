import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import {
  Asset,
  NumericColumnTransformer,
} from '../../assets/entities/asset.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assetId: string;

  @ManyToOne(() => Asset, (asset) => asset.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column()
  side: 'buy' | 'sell' | 'deposit' | 'withdraw';

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  quantity: number;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  price: number;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    default: 0,
    transformer: NumericColumnTransformer,
  })
  fee: number;

  @Column({ type: 'date' })
  date: string; // Stored as YYYY-MM-DD

  @CreateDateColumn()
  createdAt: Date;
}
