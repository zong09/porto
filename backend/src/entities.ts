import { User } from './users/entities/user.entity';
import { Portfolio } from './portfolios/entities/portfolio.entity';
import { Asset } from './assets/entities/asset.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { Liability } from './liabilities/entities/liability.entity';
import { LiabilityTransaction } from './liabilities/entities/liability-transaction.entity';
import { NetWorthHistory } from './net-worth/entities/net-worth-history.entity';

export const ENTITIES = [
  User,
  Portfolio,
  Asset,
  Transaction,
  Liability,
  LiabilityTransaction,
  NetWorthHistory,
];
