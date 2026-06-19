import { Controller, Get, Post, Query } from '@nestjs/common';
import { NetWorthService } from './net-worth.service';
import { CurrentUser, UserPayload } from '../auth/current-user.decorator';

@Controller('net-worth')
export class NetWorthController {
  constructor(private netWorthService: NetWorthService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: any) {
    return this.netWorthService.getSummary(user.userId);
  }

  @Get('history')
  async getHistory(@CurrentUser() user: any, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.netWorthService.getHistory(user.userId, daysNum);
  }

  @Post('snapshot')
  async recordSnapshot(@CurrentUser() user: any) {
    return this.netWorthService.recordSnapshot(user.userId);
  }
}
