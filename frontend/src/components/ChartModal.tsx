import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAssets, usePriceHistory, useNetWorth } from '../hooks/useApi';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export const ChartModal: React.FC = () => {
  const { modals, closeModal, activeAssetId, currency } = useStore();
  const { data: assets = [] } = useAssets();
  const { summary } = useNetWorth();
  const { t, language } = useTranslation();
  const [range, setRange] = useState<'7D' | '1M' | '3M' | '1Y'>('3M');

  const activeAsset = assets.find((a) => a.id === activeAssetId);

  // Fetch history
  const { data: series = [], isLoading, isError } = usePriceHistory(activeAsset || null, range);

  if (!modals.chart || !activeAsset) return null;

  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatNativeMoney = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    const thbDecimals = 2;

    const usdStr = '$' + usd.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const thbStr = '฿' + thb.toLocaleString('en-US', {
      minimumFractionDigits: thbDecimals,
      maximumFractionDigits: thbDecimals,
    });

    const primary = isThb ? thbStr : usdStr;
    const secondary = isThb ? usdStr : thbStr;

    return (
      <span className="tabular-nums">
        {primary}
        <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
          ({secondary})
        </span>
      </span>
    );
  };

  const ccy = activeAsset.currency as 'THB' | 'USD';
  const avgCost = activeAsset.position?.avgCost || 0;

  // Chart computations
  let chartLinePath = '';
  let chartAreaPath = '';
  let chartDotX = 0;
  let chartDotY = 0;
  let hasAvg = false;
  let avgY = 0;
  let currentPriceStr: React.ReactNode = '';
  let highPriceStr: React.ReactNode = '';
  let lowPriceStr: React.ReactNode = '';
  let changePctStr = '';
  let isUp = true;
  const xLabels: string[] = [];

  const hasData = series && series.length >= 2;

  if (hasData && !isLoading) {
    const prices = series.map((d) => d.p);
    const minVal = Math.min(...prices);
    const maxVal = Math.max(...prices);
    
    let lo = minVal;
    let hi = maxVal;
    if (avgCost > 0) {
      lo = Math.min(lo, avgCost);
      hi = Math.max(hi, avgCost);
    }

    const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
    lo -= pad;
    hi += pad;

    const width = 640;
    const height = 190;
    const top = 12;
    const bot = 168;

    const points = series.map((d, i) => {
      const x = i * (width / (series.length - 1));
      const y = bot - ((d.p - lo) / (hi - lo)) * (bot - top);
      return [x, y];
    });

    chartLinePath = `M${points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`;
    chartAreaPath = `${chartLinePath} L${width},${height} L0,${height} Z`;
    chartDotX = points[points.length - 1][0];
    chartDotY = points[points.length - 1][1];

    if (avgCost > 0) {
      hasAvg = true;
      avgY = bot - ((avgCost - lo) / (hi - lo)) * (bot - top);
    }

    const currentPrice = prices[prices.length - 1];
    const initialPrice = prices[0];
    const changePct = initialPrice > 0 ? ((currentPrice - initialPrice) / initialPrice) * 100 : 0;
    
    currentPriceStr = formatNativeMoney(currentPrice, ccy);
    highPriceStr = formatNativeMoney(maxVal, ccy);
    lowPriceStr = formatNativeMoney(minVal, ccy);
    changePctStr = `${changePct >= 0 ? '▲ +' : '▼ '}${Math.abs(changePct).toFixed(1)}%`;
    isUp = changePct >= 0;

    // Date X axis labels (4 evenly spaced)
    for (let i = 0; i < 4; i++) {
      const d = series[Math.round((i * (series.length - 1)) / 3)];
      if (d) {
        xLabels.push(new Date(d.t).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }));
      }
    }
  }

  const rangeBtnClass = (active: typeof range) =>
    `px-[14px] py-[5px] rounded-full cursor-pointer text-[12.5px] font-bold border-none transition-colors duration-150 ${
      range === active ? 'bg-dark text-surface shadow-sm' : 'bg-chipBg text-muted hover:bg-softH'
    }`;

  return (
    <div
      onClick={() => closeModal('chart')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[640px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <button
          onClick={() => closeModal('chart')}
          className="absolute top-5 right-5 text-muted hover:text-dark bg-transparent border-none cursor-pointer transition-colors p-1"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <h3 className="text-[18px] font-bold text-dark leading-none">{activeAsset.symbol}</h3>
        <p className="text-[12.5px] text-muted mt-1.5">
          {activeAsset.name && activeAsset.name !== activeAsset.symbol ? `${activeAsset.name} · ` : ''}
          {activeAsset.type === 'crypto'
            ? 'Crypto'
            : activeAsset.type === 'th'
            ? t('common.assetTypes.th')
            : t('common.assetTypes.us')}
        </p>

        {/* Range Selector */}
        <div className="flex gap-[6px] mt-[14px] mb-[6px] select-none">
          <button onClick={() => setRange('7D')} className={rangeBtnClass('7D')}>7D</button>
          <button onClick={() => setRange('1M')} className={rangeBtnClass('1M')}>1M</button>
          <button onClick={() => setRange('3M')} className={rangeBtnClass('3M')}>3M</button>
          <button onClick={() => setRange('1Y')} className={rangeBtnClass('1Y')}>1Y</button>
        </div>

        {/* Price Detail Summary */}
        {hasData && !isLoading && !isError && (
          <div className="flex justify-between items-end mt-5.5 select-none flex-wrap gap-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl.5 font-bold text-dark tabular-nums leading-none">{currentPriceStr}</span>
              <span className={`text-sm.5 font-bold flex items-center gap-0.5 ${isUp ? 'text-positive-text' : 'text-negative-text'}`}>
                {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {changePctStr}
              </span>
            </div>
            
            <div className="flex gap-4 text-xs font-semibold text-muted">
              <div>
                <span>High: </span>
                <span className="text-dark tabular-nums">{highPriceStr}</span>
              </div>
              <div>
                <span>Low: </span>
                <span className="text-dark tabular-nums">{lowPriceStr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Content Loading & Error States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[190px] mt-6">
            <div className="w-6 h-6 rounded-full border-2 border-inputBorder border-t-terracotta animate-spin"></div>
            <span className="text-xs font-semibold text-muted mt-3">
              {language === 'th' ? 'กำลังดึงข้อมูลราคาประวัติ…' : 'Fetching price history...'}
            </span>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center min-h-[190px] mt-6 text-center text-xs.5 text-lossD bg-negative-bg rounded-xl p-4">
            {language === 'th' ? 'ไม่สามารถดึงข้อมูลประวัติราคาได้ในขณะนี้' : 'Unable to fetch price history at this time'}
          </div>
        )}

        {/* SVG Price Chart */}
        {hasData && !isLoading && !isError && (
          <div className="w-full mt-6 flex flex-col items-center select-none">
            <svg viewBox="0 0 640 190" className="w-full h-auto max-h-[190px] block overflow-visible">
              <defs>
                <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--brand)', stopOpacity: 0.30 }}></stop>
                  <stop offset="1" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }}></stop>
                </linearGradient>
              </defs>
              <path d={chartAreaPath} fill="url(#chart-area)"></path>
              <path d={chartLinePath} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
              
              {/* Dash average cost line */}
              {hasAvg && (
                <>
                  <line
                    x1="0"
                    y1={avgY}
                    x2="640"
                    y2={avgY}
                    stroke="#5b8a8f"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  ></line>
                  <text
                    x="8"
                    y={avgY > 20 ? avgY - 6 : avgY + 12}
                    fill="#5b8a8f"
                    fontSize="9.5"
                    fontWeight="bold"
                    alignmentBaseline="middle"
                  >
                    {language === 'th' ? 'ต้นทุนเฉลี่ยของคุณ' : 'Your Avg Cost'} {formatNativeMoney(avgCost, ccy)}
                  </text>
                </>
              )}

              <circle cx={chartDotX} cy={chartDotY} r="4.5" fill="var(--brand)" stroke="var(--bg)" strokeWidth="2.5"></circle>
            </svg>

            {/* Date labels */}
            <div className="w-full flex justify-between text-[10px] font-bold text-faint-darker px-1.5 border-t border-inputBorder/20 pt-2.5 mt-1.5">
              {xLabels.map((l, idx) => (
                <span key={idx}>{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
