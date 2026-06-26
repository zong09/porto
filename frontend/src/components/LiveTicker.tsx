import React, { useTransition } from 'react';
import { useAssets, useNetWorth } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store/useStore';

export const LiveTicker: React.FC = () => {
  const { currency } = useStore();
  const { data: assets, isLoading, isError, refetch: refetchAssets } = useAssets();
  const { summary, takeSnapshot } = useNetWorth();
  const [isPending, startTransition] = useTransition();
  const { language } = useTranslation();

  const handleRefresh = () => {
    startTransition(async () => {
      await refetchAssets();
      await takeSnapshot.mutateAsync();
    });
  };

  const isRefreshing = isPending || isLoading;

  // Derive unique tickers (crypto/stocks)
  const tickers = React.useMemo(() => {
    if (!assets) return [];
    const seen = new Set<string>();
    const list: Array<{ symbol: string; price: number; change24h: number; currency: string }> = [];

    for (const asset of assets) {
      if (asset.type === 'deposit' || asset.type === 'fund') continue;
      if (seen.has(asset.symbol)) continue;
      seen.add(asset.symbol);

      if (asset.currentPrice !== undefined && asset.currentPrice !== null) {
        list.push({
          symbol: asset.symbol,
          price: asset.currentPrice,
          change24h: asset.change24h || 0,
          currency: asset.currency,
        });
      }
    }
    return list;
  }, [assets]);

  const fxRate = summary.data?.fx || 35.84;
  const lastUpdatedTime = React.useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }, [assets, language]);

  return (
    <div className="flex flex-col">
      {/* Ticker Row */}
      <div className="bg-dark text-white flex gap-[26px] px-[28px] py-[9px] text-[12.5px] font-semibold overflow-x-auto no-scrollbar items-center select-none">
        {tickers.map((t) => {
          const isUp = t.change24h >= 0;
          const isThb = currency === 'THB';
          const usdPrice = t.currency === 'USD' ? t.price : t.price / fxRate;
          const thbPrice = t.currency === 'USD' ? t.price * fxRate : t.price;

          const usdStr = `$${usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const thbStr = `฿${thbPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

          const priceFmt = isThb ? `${thbStr} (${usdStr})` : `${usdStr} (${thbStr})`;
          
          const changeFmt = `${isUp ? '+' : ''}${t.change24h.toFixed(1)}%`;

          return (
            <div key={t.symbol} className="flex gap-[7px] items-baseline shrink-0">
              <span className="text-faint">{t.symbol}</span>
              <span className="text-surface tabular-nums">{priceFmt}</span>
              <span className={isUp ? 'text-tickerUp' : 'text-lossL'}>{changeFmt}</span>
            </div>
          );
        })}

        {/* USD/THB Ticker */}
        <div className="flex gap-[7px] items-baseline shrink-0">
          <span className="text-faint">USD/THB</span>
          <span className="text-surface tabular-nums">฿{fxRate.toFixed(2)}</span>
        </div>

        {/* Live / Refresh controller */}
        <div className="ml-auto flex items-center gap-[12px] shrink-0 pl-[20px] bg-dark">
          <span className="text-muted">
            {language === 'th'
              ? `● LIVE · อัปเดต ${lastUpdatedTime}`
              : `● LIVE · Updated ${lastUpdatedTime}`}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-surface border-none rounded-full py-[4px] px-[14px] text-[12px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
            id="btn-refresh-prices"
          >
            {isRefreshing
              ? (language === 'th' ? 'กำลังดึงราคา…' : 'Updating prices...')
              : (language === 'th' ? 'รีเฟรช' : 'Refresh')}
          </button>
        </div>
      </div>

      {/* Warning Banner if fetch failed */}
      {isError && (
        <div className="bg-negative-bg text-lossD text-[12.5px] px-[28px] py-[7px]">
          {language === 'th'
            ? 'ดึงราคาบางรายการไม่สำเร็จ — แสดงราคาล่าสุดที่บันทึกไว้ ลองกดรีเฟรชอีกครั้ง'
            : 'Failed to fetch some prices — displaying cached prices. Click refresh to retry.'}
        </div>
      )}
    </div>
  );
};
