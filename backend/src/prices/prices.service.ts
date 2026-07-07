import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private cache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<any>>();
  private yahooCookie: string | null = null;
  private yahooCrumb: string | null = null;
  private isFetchingCrumb = false;

  private getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    return null;
  }

  private setCached(key: string, data: any, ttlMs: number) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getCryptoPrices(ids: string[], vsCurrencies: string[]): Promise<any> {
    const cacheKey = `crypto_${ids.sort().join(',')}_${vsCurrencies.sort().join(',')}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      this.logger.log(`Fetching crypto prices from CoinGecko for ids=${ids.join(',')}`);
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${vsCurrencies.join(',')}&include_24hr_change=true`;
        const headers: Record<string, string> = {};
        if (process.env.COINGECKO_API_KEY) {
          headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
        }
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`CoinGecko returned status ${response.status}`);
        }
        const data = await response.json();
        this.setCached(cacheKey, data, 60000); // 60s cache
        this.logger.log(`Successfully fetched crypto prices for ids=${ids.join(',')}`);
        return data;
      } catch (e) {
        this.logger.error(`Error fetching crypto prices: ${e.message}`);
        const stale = this.cache.get(cacheKey);
        if (stale) {
          this.logger.warn(`Returning stale cache as fallback for crypto prices ids=${ids.join(',')}`);
          return stale.data;
        }
        // Return partial or empty data if failed, caller handles fallback
        throw new HttpException('Failed to fetch crypto prices', HttpStatus.BAD_GATEWAY);
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async getCryptoHistory(coinId: string, days: number): Promise<any> {
    const cacheKey = `crypto_history_${coinId}_${days}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=thb&days=${days}`;
      const headers: Record<string, string> = {};
      if (process.env.COINGECKO_API_KEY) {
        headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`CoinGecko history status ${response.status}`);
      }
      const data = await response.json();
      this.setCached(cacheKey, data, 300000); // 5 mins cache for history
      return data;
    } catch (e) {
      this.logger.error(`Error fetching crypto history: ${e.message}`);
      const stale = this.cache.get(cacheKey);
      if (stale) {
        this.logger.warn(`Returning stale cache as fallback for crypto history coinId=${coinId}`);
        return stale.data;
      }
      throw new HttpException('Failed to fetch crypto history', HttpStatus.BAD_GATEWAY);
    }
  }

  async getStockPrice(symbol: string): Promise<any> {
    const cacheKey = `stock_${symbol}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      this.logger.log(`Fetching stock price from Yahoo Finance for symbol=${symbol}`);
      try {
        const data = await this.fetchYahooChart(symbol, '1d', '1d');
        if (data) {
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta && meta.regularMarketPrice) {
            const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
            const result = {
              price: meta.regularMarketPrice,
              chg: prev ? (meta.regularMarketPrice / prev - 1) * 100 : 0,
            };
            this.setCached(cacheKey, result, 90000); // 90s cache
            this.logger.log(`Successfully fetched stock price for symbol=${symbol}: price=${result.price}`);
            return result;
          }
      } catch (e) {
        this.logger.error(`Error fetching stock price: ${e.message}`);
        const stale = this.cache.get(cacheKey);
        if (stale) {
          this.logger.warn(`Returning stale cache as fallback for stock price symbol=${symbol}`);
          return stale.data;
        }
        throw new HttpException(`Failed to fetch stock price for ${symbol}`, HttpStatus.BAD_GATEWAY);
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async getStockHistory(symbol: string, range: string): Promise<any> {
    const cacheKey = `stock_history_${symbol}_${range}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Map range parameter
    let interval = '1d';
    if (range === '1Y') {
      interval = '1wk';
    }

    const rangeMap: Record<string, string> = {
      '7D': '7d',
      '1M': '1mo',
      '3M': '3mo',
      '1Y': '1y',
    };
    const mappedRange = rangeMap[range] || '3mo';

    try {
      const data = await this.fetchYahooChart(symbol, mappedRange, interval);
      if (data) {
        const res = data?.chart?.result?.[0];
        if (res && res.timestamp) {
          const ts = res.timestamp;
          const cl = res.indicators?.quote?.[0]?.close || [];
          const out: any[] = [];
          for (let i = 0; i < ts.length; i++) {
            if (cl[i] !== null && cl[i] !== undefined) {
              out.push({ t: ts[i] * 1000, p: cl[i] });
            }
          }
          if (out.length > 0) {
            this.setCached(cacheKey, out, 300000); // 5 mins cache for history
            return out;
          }
        }
      }
    } catch (e) {
      this.logger.error(`Error fetching stock history: ${e.message}`);
    }

    const stale = this.cache.get(cacheKey);
    if (stale) {
      this.logger.warn(`Returning stale cache as fallback for stock history symbol=${symbol}`);
      return stale.data;
    }
    throw new HttpException(`Failed to fetch stock history for ${symbol}`, HttpStatus.BAD_GATEWAY);
  }

  async getFxRate(): Promise<number> {
    const cacheKey = 'fx_rate';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log('Deriving live FX rate...');
    try {
      // Always include bitcoin in coingecko simple price to derive FX
      const data = await this.getCryptoPrices(['bitcoin'], ['thb', 'usd']);
      if (data?.bitcoin?.thb && data?.bitcoin?.usd) {
        const fx = data.bitcoin.thb / data.bitcoin.usd;
        this.setCached(cacheKey, fx, 60000); // 60s cache
        this.logger.log(`Derived live FX rate successfully: ${fx}`);
        return fx;
      }
    } catch (e) {
      this.logger.warn(`Failed to derive live FX rate, using fallback 35.84: ${e.message}`);
    }
    return 35.84; // Fallback FX rate
  }

  private async fetchYahooChart(symbol: string, range: string, interval: string): Promise<any> {
    // Try Direct Fetch first with browser User-Agent
    try {
      const result = await this.doYahooRequest(symbol, range, interval);
      if (result) return result;
    } catch (e) {
      this.logger.warn(`Yahoo Finance direct query failed for ${symbol}: ${e.message}`);
    }

    // Try Crumb Fetch if we get unauthorized or failed
    try {
      if (!this.yahooCrumb && !this.isFetchingCrumb) {
        await this.refreshYahooCredentials();
      }

      if (this.yahooCrumb) {
        const result = await this.doYahooRequest(symbol, range, interval, this.yahooCrumb, this.yahooCookie || undefined);
        if (result) return result;
      }
    } catch (e) {
      this.logger.error(`Yahoo Finance query with crumb failed for ${symbol}: ${e.message}`);
    }

    return null;
  }

  private async doYahooRequest(
    symbol: string,
    range: string,
    interval: string,
    crumb?: string,
    cookie?: string,
  ): Promise<any> {
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    if (crumb) {
      url += `&crumb=${encodeURIComponent(crumb)}`;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Yahoo Finance status ${response.status}`);
    }
    return response.json();
  }

  private async refreshYahooCredentials() {
    this.isFetchingCrumb = true;
    try {
      // 1. Visit Yahoo to get cookies
      const fcResponse = await fetch('https://fc.yahoo.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const setCookie = fcResponse.headers.get('set-cookie');
      if (setCookie) {
        this.yahooCookie = setCookie.split(';')[0];
      }

      // 2. Get the crumb
      const crumbUrl = 'https://query2.finance.yahoo.com/v1/test/getcrumb';
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (this.yahooCookie) {
        headers['Cookie'] = this.yahooCookie;
      }

      const crumbResponse = await fetch(crumbUrl, { headers });
      if (crumbResponse.ok) {
        this.yahooCrumb = await crumbResponse.text();
        this.logger.log('Yahoo Finance crumb refreshed successfully');
      } else {
        this.logger.warn(`Yahoo Finance crumb endpoint failed: ${crumbResponse.status}`);
      }
    } catch (e) {
      this.logger.error(`Failed to get Yahoo crumb: ${e.message}`);
    } finally {
      this.isFetchingCrumb = false;
    }
  }
}
