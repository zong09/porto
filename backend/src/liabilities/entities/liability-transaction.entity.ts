import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Liability } from './liability.entity';
import { NumericColumnTransformer } from '../../assets/entities/asset.entity';

@Entity('liability_transactions')
export class LiabilityTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  liabilityId: string;

  @ManyToOne(() => Liability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liabilityId' })
  liability: Liability;

  @Column()
  type: 'pay' | 'add';

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  amount: number;

  @Column({ type: 'date' })
  date: string; // Stored as YYYY-MM-DD

  @CreateDateColumn()
  createdAt: Date;
}
