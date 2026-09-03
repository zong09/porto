import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { HttpException } from '@nestjs/common';

/**
 * Every test drives the service through a URL-dispatching `fetch` mock. Any URL
 * without a handler rejects loudly rather than reaching the real Binance/Yahoo
 * endpoints, so a stale mock shows up as a failure instead of a network call.
 */
type FetchHandlers = Record<string, () => any>;

function mockFetch(handlers: FetchHandlers) {
  return jest.spyOn(global, 'fetch').mockImplementation(((url: string) => {
    for (const [fragment, respond] of Object.entries(handlers)) {
      if (url.includes(fragment)) return Promise.resolve(respond());
    }
    return Promise.reject(new Error(`unmocked fetch: ${url}`));
  }) as any);
}

const YAHOO_CHART = 'query1.finance.yahoo.com/v8/finance/chart';
const BINANCE_TICKER = 'api.binance.com/api/v3/ticker/24hr';
const BINANCE_KLINES = 'api.binance.com/api/v3/klines';

const FX = 35.5;

// getCryptoPrices/getCryptoHistory derive FX from Yahoo `THB=X` before hitting Binance.
const fxHandler = () => ({
  ok: true,
  json: jest.fn().mockResolvedValue({
    chart: { result: [{ meta: { regularMarketPrice: FX } }] },
  }),
});

describe('PricesService', () => {
  let service: PricesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricesService],
    }).compile();

    service = module.get<PricesService>(PricesService);
    // Clear map/cache to prevent side effects between tests
    (service as any).cache.clear();
    // Reset credentials
    (service as any).yahooCookie = null;
    (service as any).yahooCrumb = null;
    // Safety net: a test that forgets a handler fails instead of going to the network.
    mockFetch({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCryptoPrices', () => {
    it('should successfully fetch crypto prices and cache them', async () => {
      const fetchSpy = mockFetch({
        [YAHOO_CHART]: fxHandler,
        [BINANCE_TICKER]: () => ({
          ok: true,
          json: jest.fn().mockResolvedValue([
            {
              symbol: 'BTCUSDT',
              lastPrice: '60000',
              priceChangePercent: '1.5',
            },
          ]),
        }),
      });

      const expected = {
        BTC: {
          usd: 60000,
          usd_24h_change: 1.5,
          thb: 60000 * FX,
          thb_24h_change: 1.5,
        },
      };

      const result = await service.getCryptoPrices(['BTC'], ['thb', 'usd']);
      expect(result).toEqual(expected);
      expect(fetchSpy).toHaveBeenCalled();

      // Second call should return cached data without fetch
      fetchSpy.mockClear();
      const cachedResult = await service.getCryptoPrices(
        ['BTC'],
        ['thb', 'usd'],
      );
      expect(cachedResult).toEqual(expected);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    // NOTE: asserts current behaviour, which is *not* the HttpException the method's
    // catch block suggests — every upstream failure is swallowed (Binance batch →
    // per-symbol → Yahoo fallback), so nothing reaches the catch and the method
    // resolves with the symbol simply absent. Callers read that as price 0 rather
    // than falling back to manualPrice/avgCost.
    it('should resolve without the symbol when every upstream lookup fails', async () => {
      mockFetch({
        [YAHOO_CHART]: () => ({ ok: false, status: 500 }),
        [BINANCE_TICKER]: () => ({ ok: false, status: 500 }),
        'fc.yahoo.com': () => ({ ok: false, headers: { get: () => null } }),
        'query2.finance.yahoo.com/v1/test/getcrumb': () => ({ ok: false }),
      });

      await expect(service.getCryptoPrices(['BTC'], ['usd'])).resolves.toEqual(
        {},
      );
    });
  });

  describe('getCryptoHistory', () => {
    it('should successfully fetch crypto history', async () => {
      mockFetch({
        [YAHOO_CHART]: fxHandler,
        // Binance kline tuple: [openTime, open, high, low, close, ...]
        [BINANCE_KLINES]: () => ({
          ok: true,
          json: jest
            .fn()
            .mockResolvedValue([
              [1700000000000, '57000', '59000', '56000', '58000'],
            ]),
        }),
      });

      const result = await service.getCryptoHistory('BTC', 30);
      expect(result).toEqual({ prices: [[1700000000000, 58000 * FX]] });
    });

    it('should throw HttpException on API error', async () => {
      mockFetch({
        [YAHOO_CHART]: fxHandler,
        [BINANCE_KLINES]: () => ({ ok: false, status: 500 }),
      });

      await expect(service.getCryptoHistory('BTC', 30)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getStockPrice', () => {
    it('should successfully fetch stock price', async () => {
      mockFetch({
        [YAHOO_CHART]: () => ({
          ok: true,
          json: jest.fn().mockResolvedValue({
            chart: {
              result: [
                { meta: { regularMarketPrice: 180, previousClose: 175 } },
              ],
            },
          }),
        }),
      });

      const result = await service.getStockPrice('AAPL');
      expect(result).toEqual({
        price: 180,
        chg: (180 / 175 - 1) * 100,
      });
    });

    // NOTE: asserts current behaviour. `fetchYahooChart` swallows both the direct
    // and the crumb attempt and returns null, so getStockPrice falls out of its
    // try block and returns undefined — the HttpException below it is unreachable
    // for a plain upstream failure.
    it('should resolve undefined when Yahoo returns nothing', async () => {
      mockFetch({
        [YAHOO_CHART]: () => ({ ok: false, status: 500 }),
        'fc.yahoo.com': () => ({ ok: false, headers: { get: () => null } }),
        'query2.finance.yahoo.com/v1/test/getcrumb': () => ({ ok: false }),
      });

      await expect(service.getStockPrice('AAPL')).resolves.toBeUndefined();
    });
  });

  describe('getStockHistory', () => {
    it('should successfully fetch stock history', async () => {
      mockFetch({
        [YAHOO_CHART]: () => ({
          ok: true,
          json: jest.fn().mockResolvedValue({
            chart: {
              result: [
                {
                  timestamp: [1700000000],
                  indicators: { quote: [{ close: [175] }] },
                },
              ],
            },
          }),
        }),
      });

      const result = await service.getStockHistory('AAPL', '3M');
      expect(result).toEqual([{ t: 1700000000000, p: 175 }]);
    });

    it('should throw HttpException on API error', async () => {
      mockFetch({
        [YAHOO_CHART]: () => ({ ok: false, status: 500 }),
        'fc.yahoo.com': () => ({ ok: false, headers: { get: () => null } }),
        'query2.finance.yahoo.com/v1/test/getcrumb': () => ({ ok: false }),
      });

      await expect(service.getStockHistory('AAPL', '3M')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getFxRate', () => {
    it('should successfully get fx rate', async () => {
      jest.spyOn(service, 'getStockPrice').mockResolvedValue({ price: FX });

      const rate = await service.getFxRate();
      expect(rate).toBe(FX);
      expect(service.getStockPrice).toHaveBeenCalledWith('THB=X');
    });

    it('should return fallback FX rate on exception', async () => {
      jest
        .spyOn(service, 'getStockPrice')
        .mockRejectedValue(new Error('API failure'));

      const rate = await service.getFxRate();
      expect(rate).toBe(35.84); // fallback
    });
  });

  describe('refreshYahooCredentials', () => {
    it('should refresh credentials successfully', async () => {
      mockFetch({
        'fc.yahoo.com': () => ({
          headers: { get: jest.fn().mockReturnValue('A_COOKIE=123; path=/') },
        }),
        'query2.finance.yahoo.com/v1/test/getcrumb': () => ({
          ok: true,
          text: jest.fn().mockResolvedValue('A_CRUMB_123'),
        }),
      });

      await (service as any).refreshYahooCredentials();
      expect((service as any).yahooCookie).toBe('A_COOKIE=123');
      expect((service as any).yahooCrumb).toBe('A_CRUMB_123');
    });
  });
});
