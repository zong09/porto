import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Portfolio } from '../../portfolios/entities/portfolio.entity';
import { Liability } from '../../liabilities/entities/liability.entity';
import { NetWorthHistory } from '../../net-worth/entities/net-worth-history.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: false })
  isDemo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios: Portfolio[];

  @OneToMany(() => Liability, (liability) => liability.user)
  liabilities: Liability[];

  @OneToMany(() => NetWorthHistory, (history) => history.user)
  netWorthHistory: NetWorthHistory[];
}
