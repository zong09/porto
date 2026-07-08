import {
  Controller,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PricesService } from './prices.service';

// Ticker symbols only — blocks query-param injection into upstream price APIs
const SYMBOL_RE = /^[A-Za-z0-9.\-^=]{1,15}$/;

function assertValidSymbol(value: string, label: string): void {
  if (!SYMBOL_RE.test(value)) {
    throw new HttpException(`Invalid ${label}`, HttpStatus.BAD_REQUEST);
  }
}

@Controller('prices')
export class PricesController {
  constructor(private pricesService: PricesService) {}

  @Get('crypto')
  async getCrypto(
    @Query('ids') ids: string,
    @Query('vs_currencies') vsCurrencies: string,
  ) {
    if (!ids || !vsCurrencies) {
      throw new HttpException(
        'Missing ids or vs_currencies parameters',
        HttpStatus.BAD_REQUEST,
      );
    }
    const idsList = ids.split(',');
    const currenciesList = vsCurrencies.split(',');
    idsList.forEach((id) => assertValidSymbol(id, 'crypto id'));
    currenciesList.forEach((c) => assertValidSymbol(c, 'currency'));
    return this.pricesService.getCryptoPrices(idsList, currenciesList);
  }

  @Get('crypto/:coinId/history')
  async getCryptoHistory(
    @Param('coinId') coinId: string,
    @Query('days') days: string,
  ) {
    assertValidSymbol(coinId, 'coin id');
    const daysNum = days ? parseInt(days, 10) : 30;
    if (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 3650) {
      throw new HttpException('Invalid days', HttpStatus.BAD_REQUEST);
    }
    return this.pricesService.getCryptoHistory(coinId, daysNum);
  }

  @Get('stock/:symbol')
  async getStock(@Param('symbol') symbol: string) {
    assertValidSymbol(symbol, 'symbol');
    return this.pricesService.getStockPrice(symbol);
  }

  @Get('stock/:symbol/history')
  async getStockHistory(
    @Param('symbol') symbol: string,
    @Query('range') range: string,
  ) {
    assertValidSymbol(symbol, 'symbol');
    const r = range || '3M';
    assertValidSymbol(r, 'range');
    return this.pricesService.getStockHistory(symbol, r);
  }

  @Get('fx')
  async getFx() {
    const rate = await this.pricesService.getFxRate();
    return { rate };
  }
}
