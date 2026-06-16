import React, { useTransition } from 'react';
import { useAssets, useNetWorth } from '../hooks/useApi';

export const LiveTicker: React.FC = () => {
  const { data: assets, isLoading, isError, refetch: refetchAssets } = useAssets();
  const { summary, takeSnapshot } = useNetWorth();
  const [isPending, startTransition] = useTransition();

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
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }, [assets]);

  return (
    <div className="flex flex-col">
      {/* Ticker Row */}
      <div className="bg-[#3d3328] text-white flex gap-[26px] px-[28px] py-[9px] text-[12.5px] font-semibold overflow-x-auto no-scrollbar items-center select-none">
        {tickers.map((t) => {
          const isUp = t.change24h >= 0;
          const priceFmt =
            t.currency === 'USD'
              ? `$${t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `฿${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
          
          const changeFmt = `${isUp ? '+' : ''}${t.change24h.toFixed(1)}%`;

          return (
            <div key={t.symbol} className="flex gap-[7px] items-baseline shrink-0">
              <span className="text-faint">{t.symbol}</span>
              <span className="text-surface tabular-nums">{priceFmt}</span>
              <span className={isUp ? 'text-[#c9e08a]' : 'text-[#f0a98f]'}>{changeFmt}</span>
            </div>
          );
        })}

        {/* USD/THB Ticker */}
        <div className="flex gap-[7px] items-baseline shrink-0">
          <span className="text-faint">USD/THB</span>
          <span className="text-surface tabular-nums">฿{fxRate.toFixed(2)}</span>
        </div>

        {/* Live / Refresh controller */}
        <div className="ml-auto flex items-center gap-[12px] shrink-0 pl-[20px] bg-[#3d3328]">
          <span className="text-muted">
            ● LIVE · อัปเดต {lastUpdatedTime}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-[#4d4133] hover:bg-[#5a4c3c] text-surface border-none rounded-full py-[4px] px-[14px] text-[12px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
            id="btn-refresh-prices"
          >
            {isRefreshing ? 'กำลังดึงราคา…' : 'รีเฟรช'}
          </button>
        </div>
      </div>

      {/* Warning Banner if fetch failed */}
      {isError && (
        <div className="bg-[#f3ded6] text-[#84422e] text-[12.5px] px-[28px] py-[7px]">
          ดึงราคาบางรายการไม่สำเร็จ — แสดงราคาล่าสุดที่บันทึกไว้ ลองกดรีเฟรชอีกครั้ง
        </div>
      )}
    </div>
  );
};
