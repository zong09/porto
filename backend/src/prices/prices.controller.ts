import { Controller, Get, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PricesService } from './prices.service';

@Controller('prices')
export class PricesController {
  constructor(private pricesService: PricesService) {}

  @Get('crypto')
  async getCrypto(
    @Query('ids') ids: string,
    @Query('vs_currencies') vsCurrencies: string,
  ) {
    if (!ids || !vsCurrencies) {
      throw new HttpException('Missing ids or vs_currencies parameters', HttpStatus.BAD_REQUEST);
    }
    const idsList = ids.split(',');
    const currenciesList = vsCurrencies.split(',');
    return this.pricesService.getCryptoPrices(idsList, currenciesList);
  }

  @Get('crypto/:coinId/history')
  async getCryptoHistory(
    @Param('coinId') coinId: string,
    @Query('days') days: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.pricesService.getCryptoHistory(coinId, daysNum);
  }

  @Get('stock/:symbol')
  async getStock(@Param('symbol') symbol: string) {
    return this.pricesService.getStockPrice(symbol);
  }

  @Get('stock/:symbol/history')
  async getStockHistory(
    @Param('symbol') symbol: string,
    @Query('range') range: string,
  ) {
    const r = range || '3M';
    return this.pricesService.getStockHistory(symbol, r);
  }

  @Get('fx')
  async getFx() {
    const rate = await this.pricesService.getFxRate();
    return { rate };
  }
}
