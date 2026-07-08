import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

const DEMO_USER_MAX_AGE_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class DemoCleanupService {
  private readonly logger = new Logger(DemoCleanupService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async removeStaleDemoUsers(): Promise<void> {
    const cutoff = new Date(Date.now() - DEMO_USER_MAX_AGE_MS);
    const result = await this.userRepository.delete({
      isDemo: true,
      createdAt: LessThan(cutoff),
    });
    if (result.affected) {
      this.logger.log(
        `Removed ${result.affected} demo user(s) older than 48h (cascade cleans their data)`,
      );
    }
  }
}
