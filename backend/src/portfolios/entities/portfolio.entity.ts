import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Asset } from '../../assets/entities/asset.entity';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  color: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.portfolios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Asset, (asset) => asset.portfolio)
  assets: Asset[];
}
