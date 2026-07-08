import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NumericColumnTransformer } from '../../assets/entities/asset.entity';

@Entity('liabilities')
export class Liability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.liabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column('numeric', {
    precision: 20,
    scale: 8,
    transformer: NumericColumnTransformer,
  })
  amount: number;

  @Column({ default: 'THB' })
  currency: string;
}
