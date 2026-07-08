import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NumericColumnTransformer } from '../../assets/entities/asset.entity';

@Entity('net_worth_history')
@Unique(['userId', 'date'])
export class NetWorthHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.netWorthHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  totalAssetsThb: number;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  totalLiabilitiesThb: number;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  netWorthThb: number;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
    nullable: true,
  })
  fxRate: number | null;
}
