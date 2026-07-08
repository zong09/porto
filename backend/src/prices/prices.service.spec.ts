import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { HttpException } from '@nestjs/common';

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCryptoPrices', () => {
    it('should successfully fetch crypto prices and cache them', async () => {
      const mockResponse = {
        bitcoin: { thb: 2150400, usd: 60000, usd_24h_change: 1.5 },
      };

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await service.getCryptoPrices(['bitcoin'], ['thb', 'usd']);
      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalled();

      // Second call should return cached data without fetch
      fetchSpy.mockClear();
      const cachedResult = await service.getCryptoPrices(
        ['bitcoin'],
        ['thb', 'usd'],
      );
      expect(cachedResult).toEqual(mockResponse);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should throw HttpException on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(
        service.getCryptoPrices(['bitcoin'], ['usd']),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getCryptoHistory', () => {
    it('should successfully fetch crypto history', async () => {
      const mockHistory = { prices: [[1700000000000, 58000]] };
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHistory),
      } as any);

      const result = await service.getCryptoHistory('bitcoin', 30);
      expect(result).toEqual(mockHistory);
    });

    it('should throw HttpException on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as any);

      await expect(service.getCryptoHistory('bitcoin', 30)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getStockPrice', () => {
    it('should successfully fetch stock price', async () => {
      const mockYahooResult = {
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 180,
                previousClose: 175,
              },
            },
          ],
        },
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockYahooResult),
      } as any);

      const result = await service.getStockPrice('AAPL');
      expect(result).toEqual({
        price: 180,
        chg: (180 / 175 - 1) * 100,
      });
    });

    it('should throw HttpException on error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as any);

      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getStockHistory', () => {
    it('should successfully fetch stock history', async () => {
      const mockYahooResult = {
        chart: {
          result: [
            {
              timestamp: [1700000000],
              indicators: {
                quote: [
                  {
                    close: [175],
                  },
                ],
              },
            },
          ],
        },
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockYahooResult),
      } as any);

      const result = await service.getStockHistory('AAPL', '3M');
      expect(result).toEqual([{ t: 1700000000000, p: 175 }]);
    });

    it('should throw HttpException on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as any);

      await expect(service.getStockHistory('AAPL', '3M')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getFxRate', () => {
    it('should successfully get fx rate', async () => {
      const mockCryptoResponse = {
        bitcoin: { thb: 2150400, usd: 60000 },
      };

      jest
        .spyOn(service, 'getCryptoPrices')
        .mockResolvedValue(mockCryptoResponse);

      const rate = await service.getFxRate();
      expect(rate).toBe(35.84); // 2150400 / 60000 = 35.84
    });

    it('should return fallback FX rate on exception', async () => {
      jest
        .spyOn(service, 'getCryptoPrices')
        .mockRejectedValue(new Error('API failure'));

      const rate = await service.getFxRate();
      expect(rate).toBe(35.84); // fallback
    });
  });

  describe('refreshYahooCredentials', () => {
    it('should refresh credentials successfully', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      // 1. fc.yahoo.com
      fetchSpy.mockResolvedValueOnce({
        headers: {
          get: jest.fn().mockReturnValue('A_COOKIE=123; path=/'),
        },
      } as any);

      // 2. getcrumb
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('A_CRUMB_123'),
      } as any);

      await (service as any).refreshYahooCredentials();
      expect((service as any).yahooCookie).toBe('A_COOKIE=123');
      expect((service as any).yahooCrumb).toBe('A_CRUMB_123');
    });
  });
});
