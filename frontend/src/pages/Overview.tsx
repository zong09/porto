import React from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useNetWorth, useAuthConfig } from '../hooks/useApi';
import { HelpCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useTranslation } from '../hooks/useTranslation';

export const Overview: React.FC = () => {
  const { currency, setPage, openModal } = useStore();
  const { data: portfolios = [], isLoading: loadingPorts } = usePortfolios();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { summary, history } = useNetWorth(365);
  const { data: config } = useAuthConfig();
  const { t, language } = useTranslation();

  const portfoliosCount = portfolios.length;
  const hasAssets = assets.length > 0;
  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatMoney = (val: number) => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);

    const usdStr = '$' + absUsd.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    const thbStr = '฿' + absThb.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

    const primary = isThb ? thbStr : usdStr;
    const secondary = isThb ? usdStr : thbStr;

    return (
      <span className="tabular-nums">
        {isNeg ? '-' : ''}{primary}
        <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
          ({isNeg ? '-' : ''}{secondary})
        </span>
      </span>
    );
  };

  const formatAbbrMoney = (val: number, forcePlusSign = false) => {
    const usd = val / fx;
    const thb = val;

    const getAbbr = (value: number, sign: string) => {
      const absVal = Math.abs(value);
      const isNeg = value < 0;
      let leadingSign = '';
      if (isNeg) {
        leadingSign = '−';
      } else if (forcePlusSign && value > 0) {
        leadingSign = '+';
      }

      let formatted = '';
      if (absVal >= 1e6) {
        formatted = `${(absVal / 1e6).toFixed(1)}M`;
      } else if (absVal >= 1000) {
        formatted = `${(absVal / 1000).toFixed(0)}k`;
      } else {
        formatted = absVal.toFixed(0);
      }
      return `${leadingSign}${sign}${formatted}`;
    };

    const primary = isThb ? getAbbr(thb, '฿') : getAbbr(usd, '$');
    const secondary = isThb ? getAbbr(usd, '$') : getAbbr(thb, '฿');

    return (
      <span className="tabular-nums">
        {primary}
        <span className="text-[0.72em] text-faint ml-1 font-semibold">
          ({secondary})
        </span>
      </span>
    );
  };

  // 1. Current Stats
  const totalAssets = summary.data?.totalAssetsThb || 0;
  const totalLiabilities = summary.data?.totalLiabilitiesThb || 0;
  const netWorth = summary.data?.netWorthThb || 0;
  const todayPl = summary.data?.todayPlThb || 0;

  // 2. Month-over-Month Net Worth Change
  let MoMChangeLabel = '—';
  let MoMChangeUp = true;
  const historyData = history.data || [];
  if (historyData.length >= 2) {
    const dayMs = 86400000;
    const cutoffDateStr = new Date(Date.now() - 28 * dayMs).toISOString().slice(0, 10);
    let oldPoint = historyData[0];
    for (const p of historyData) {
      if (p.date <= cutoffDateStr) {
        oldPoint = p;
      }
    }
    if (oldPoint && Number(oldPoint.netWorthThb) > 0) {
      const pct = ((netWorth - Number(oldPoint.netWorthThb)) / Number(oldPoint.netWorthThb)) * 100;
      MoMChangeUp = pct >= 0;
      MoMChangeLabel = `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(1)}% ${t('overview.monthAbbr')}`;
    }
  }

  // 3. Historical Area Chart (custom SVG)
  let nwLinePath = '';
  let nwAreaPath = '';
  let nwDotX = 0;
  let nwDotY = 0;
  let xLabels: string[] = [];

  let chartHistoryPoints = [...historyData].slice(-60);
  if (chartHistoryPoints.length === 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const prevDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    chartHistoryPoints = [
      { id: 'placeholder-1', date: prevDate, netWorthThb: 0, totalAssetsThb: 0, totalLiabilitiesThb: 0, fxRate: fx } as any,
      { id: 'placeholder-2', date: todayStr, netWorthThb: netWorth, totalAssetsThb: totalAssets, totalLiabilitiesThb: totalLiabilities, fxRate: fx } as any
    ];
  } else if (chartHistoryPoints.length === 1) {
    const prevDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const onlyPoint = chartHistoryPoints[0];
    chartHistoryPoints = [
      { id: 'placeholder-1', date: prevDate, netWorthThb: 0, totalAssetsThb: 0, totalLiabilitiesThb: 0, fxRate: onlyPoint.fxRate || fx } as any,
      onlyPoint
    ];
  }

  if (chartHistoryPoints.length >= 2) {
    const values = chartHistoryPoints.map((h) => {
      const pointFx = h.fxRate || fx;
      return isThb ? Number(h.netWorthThb) : Number(h.netWorthThb) / pointFx;
    });
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.15 || Math.abs(max) * 0.05 || 1;
    const lo = min - pad;
    const hi = max + pad;

    const width = 1100;
    const height = 170;
    const paddingBottom = 10;
    const paddingTop = 12;

    const points = chartHistoryPoints.map((h, i) => {
      const pointFx = h.fxRate || fx;
      const val = isThb ? Number(h.netWorthThb) : Number(h.netWorthThb) / pointFx;
      const x = i * (width / (chartHistoryPoints.length - 1));
      const y = height - paddingBottom - ((val - lo) / (hi - lo)) * (height - paddingBottom - paddingTop);
      return [x, y];
    });

    nwLinePath = `M${points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`;
    nwAreaPath = `${nwLinePath} L${width},${height} L0,${height} Z`;
    nwDotX = points[points.length - 1][0];
    nwDotY = points[points.length - 1][1];

    // Label coordinates
    if (chartHistoryPoints.length <= 5) {
      xLabels = chartHistoryPoints.map((p) => {
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: '2-digit' });
      });
    } else {
      for (let i = 0; i < 5; i++) {
        const point = chartHistoryPoints[Math.round((i * (chartHistoryPoints.length - 1)) / 4)];
        if (point) {
          const d = new Date(point.date + 'T00:00:00');
          xLabels.push(d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: '2-digit' }));
        }
      }
    }
  }

  // 4. Portfolio Card data calculations
  const portfolioSummaries = React.useMemo(() => {
    return portfolios.map((p) => {
      const pAssets = assets.filter((a) => a.portfolioId === p.id);
      let pValueThb = 0;
      let pCostThb = 0;
      const types = new Set<string>();

      const typeLabels: Record<string, string> = {
        crypto: t('common.assetTypes.crypto'),
        th: t('common.assetTypes.th'),
        us: t('common.assetTypes.us'),
        fund: t('common.assetTypes.fund'),
        deposit: t('common.assetTypes.deposit'),
      };

      for (const a of pAssets) {
        if (!a.position || a.position.quantity <= 0) continue;
        const multiplier = a.currency === 'USD' ? fx : 1;
        const isShort = (a.direction || 'long') === 'short';
        const assetVal = a.position.quantity * (a.currentPrice || 0) * multiplier;
        if (isShort) {
          pValueThb -= assetVal;
        } else {
          pValueThb += assetVal;
        }
        pCostThb += a.position.quantity * a.position.avgCost * multiplier;
        types.add(typeLabels[a.type]);
      }

      const pReturnPct = pCostThb > 0 ? ((pValueThb - pCostThb) / pCostThb) * 100 : 0;
      const assetPctOfTotal = totalAssets > 0 ? (pValueThb / totalAssets) * 100 : 0;

      return {
        ...p,
        valueThb: pValueThb,
        costThb: pCostThb,
        returnPct: pReturnPct,
        pctOfTotal: assetPctOfTotal,
        desc: `${Array.from(types).join(' · ')} · ${pAssets.length} ${t('overview.itemsCount')}`,
      };
    });
  }, [portfolios, assets, totalAssets, fx, language]);

  // Donut chart CSS gradient segments
  const donutGradient = React.useMemo(() => {
    const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
    let accum = 0;
    const segs: string[] = [];

    const activePortfolios = portfolioSummaries.filter((p) => p.valueThb > 0);
    activePortfolios.forEach((pv) => {
      if (totalAssets <= 0) return;
      const share = (pv.valueThb / totalAssets) * 100;
      const nextAccum = accum + share;
      const color = palette[pv.color % 6];
      segs.push(`${color} ${accum.toFixed(2)}% ${nextAccum.toFixed(2)}%`);
      accum = nextAccum;
    });

    return segs.length > 0 ? `conic-gradient(${segs.join(', ')})` : '#f0e7d8';
  }, [portfolioSummaries, totalAssets]);

  // Asset P&L vertical bars (top 7 by absolute P&L)
  const barChartData = React.useMemo(() => {
    const items = assets
      .map((a) => {
        if (!a.position || a.position.quantity <= 0 || a.type === 'deposit') return null;
        const multiplier = a.currency === 'USD' ? fx : 1;
        const isShort = (a.direction || 'long') === 'short';
        const value = a.position.quantity * (a.currentPrice || 0) * multiplier;
        const cost = a.position.quantity * a.position.avgCost * multiplier;
        // Short: profit when price drops (cost - value); Long: profit when price rises (value - cost)
        const plThb = isShort ? (cost - value) : (value - cost);
        return {
          symbol: a.symbol,
          plThb,
        };
      })
      .filter((x): x is { symbol: string; plThb: number } => x !== null && Math.abs(x.plThb) > 0.5)
      .sort((a, b) => b.plThb - a.plThb)
      .slice(0, 7);

    const maxAbs = Math.max(...items.map((x) => Math.abs(x.plThb)), 1);

    const greens = ['#7a8f55', '#93a86b', '#b3c48d', '#cdd9b3', '#dde5cc'];
    const reds = ['#c4654a', '#dca08c', '#e6bcae'];
    let gi = 0;
    let ri = 0;

    return items.map((x) => {
      const isProfit = x.plThb >= 0;
      const heightPercent = Math.round((Math.abs(x.plThb) / maxAbs) * 100);
      const color = isProfit
        ? greens[Math.min(gi++, greens.length - 1)]
        : reds[Math.min(ri++, reds.length - 1)];

      return {
        symbol: x.symbol,
        isProfit,
        heightPercent: Math.max(10, heightPercent), // At least 10% height for visibility
        color,
        valLabel: formatAbbrMoney(x.plThb, true),
      };
    });
  }, [assets, fx, currency]);

  // Liabilities vs Assets ratios
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const debtNoteText =
    debtRatio < 30 ? t('overview.debtNoteGood') : debtRatio < 50 ? t('overview.debtNoteWarn') : t('overview.debtNoteBad');
  const debtNoteColor = debtRatio < 30 ? 'text-[#a3b87a]' : debtRatio < 50 ? 'text-[#e0b46a]' : 'text-[#d98f70]';

  // Empty state loading or data
  if (loadingPorts || loadingAssets || summary.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">{t('overview.loadingOverview')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Overview">
      {/* 1. Hero Net Worth */}
      <div className="flex flex-col items-center gap-1.5 py-8 text-center">
        <h2 className="text-xs.5 md:text-sm font-semibold text-muted tracking-wide">{t('overview.netWorth')}</h2>
        <span className="text-[34px] md:text-[52px] font-bold text-dark tabular-nums tracking-tight leading-none">
          {formatMoney(netWorth)}
        </span>
        <div className="flex items-center gap-2.5 text-xs.5 md:text-sm flex-wrap justify-center mt-1">
          <div
            className={`px-3 py-0.5 rounded-full font-bold select-none ${
              MoMChangeUp ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
            }`}
          >
            {MoMChangeLabel}
          </div>
          <div className="text-faint">
            {t('overview.updatedText')}
          </div>
        </div>
      </div>

      {/* 2. Mini Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 max-w-[650px] mx-auto w-full px-2">
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.totalAssets')}</span>
          <span className="text-lg.5 font-bold text-dark tabular-nums">{formatMoney(totalAssets)}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.liabilities')}</span>
          <span className="text-lg.5 font-bold text-[#84422e] tabular-nums">{formatMoney(totalLiabilities)}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.todayPl')}</span>
          <span
            className={`text-lg.5 font-bold tabular-nums ${
              todayPl >= 0 ? 'text-positive-text' : 'text-negative-text'
            }`}
          >
            {todayPl >= 0 ? '+' : ''}
            {formatMoney(todayPl)}
          </span>
        </div>
      </div>

      {/* 3. Net Worth Area Chart */}
      {chartHistoryPoints.length >= 2 && (
        <div className="w-full flex flex-col items-center mt-10">
          <svg viewBox="0 0 1100 170" className="w-full max-h-[170px] select-none block overflow-visible">
            <defs>
              <linearGradient id="nw-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: '#c97a52', stopOpacity: 0.32 }}></stop>
                <stop offset="1" style={{ stopColor: '#c97a52', stopOpacity: 0 }}></stop>
              </linearGradient>
            </defs>
            <path d={nwAreaPath} fill="url(#nw-area)"></path>
            <path d={nwLinePath} fill="none" stroke="#b45a3c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path>
            <circle cx={nwDotX} cy={nwDotY} r="5" fill="#b45a3c" stroke="#faf5ec" strokeWidth="3"></circle>
          </svg>
          <div className="w-full flex justify-between text-[11px] font-bold text-faint-darker px-1 mt-1.5 border-t border-inputBorder/20 pt-2">
            {xLabels.map((label, idx) => (
              <span key={idx}>{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* 4. Empty State */}
      {!hasAssets && (
        <div className="bg-white border border-inputBorder/25 rounded-2.5xl p-10 text-center flex flex-col items-center gap-3 mt-10 select-none">
          <HelpCircle size={38} className="text-muted/65" />
          <h3 className="text-base.5 font-bold text-dark">{t('overview.emptyTitle')}</h3>
          <p className="text-xs.5 text-muted max-w-[340px]">
            {t('overview.emptyDesc')}
          </p>
          <div className="flex gap-2.5 mt-2 flex-wrap">
            <button
              onClick={() => openModal('portfolio')}
              className="px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold border-none cursor-pointer shadow-sm transition-colors"
            >
              {t('overview.createPort')}
            </button>
            {config?.enableDemo && (
              <button
                onClick={async () => {
                  if (confirm(t('footer.confirmLoadDemo'))) {
                    const res = await apiClient.post('/auth/demo');
                    useStore.getState().login(res.data.user, res.data.token);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-xs font-bold border-none cursor-pointer transition-colors"
              >
                {t('footer.loadDemo')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Content Grid */}
      {hasAssets && (
        <>
          {/* Portfolio List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {portfolioSummaries.map((c) => {
              const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
              const tints = ['#EFF3E6', '#F3E9DC', '#F2E0D8', '#E2EDEA', '#EAE4F0', '#F2E2E8'];
              const i = c.color;

              return (
                <div
                  key={c.id}
                  onClick={() => setPage('ports')}
                  className="rounded-md p-4 flex flex-col shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: tints[i % 6] }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[15px] font-bold text-dark">{c.name}</span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/90 shadow-sm"
                      style={{ color: c.returnPct >= 0 ? '#4f7136' : '#b4543c' }}
                    >
                      {c.returnPct >= 0 ? '+' : ''}
                      {c.returnPct.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-[26px] font-bold text-dark tabular-nums tracking-tight leading-none mb-1">
                    {formatMoney(c.valueThb)}
                  </span>
                  <p className="text-[11.5px] text-muted font-medium mb-3">{c.desc}</p>
                  
                  {/* Progress bar */}
                  <div className="mt-auto flex flex-col gap-1.5">
                    <div className="h-2 bg-white rounded-full overflow-hidden select-none">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, Math.min(100, c.pctOfTotal))}%`,
                          backgroundColor: palette[i % 6],
                        }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-faint-darker font-bold">
                      {c.pctOfTotal.toFixed(1)}% {t('overview.pctOfTotalAssets')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Charts Row - Unified Container */}
          <div className="grid grid-cols-1 lg:grid-cols-3 mt-6 items-stretch border border-inputBorder/20 shadow-sm rounded-md overflow-hidden bg-white">
            {/* Allocation Donut */}
            <div className="p-5 md:p-6 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-inputBorder/20">
              <h3 className="text-[15px] font-bold text-dark">{t('overview.portsAllocation')}</h3>
              <div className="flex flex-col items-center gap-6 my-auto">
                <div className="relative w-[140px] h-[140px] shrink-0 mt-2">
                  <div
                    className="w-[140px] h-[140px] rounded-full shadow-inner"
                    style={{ background: donutGradient }}
                  ></div>
                  <div className="absolute inset-[24px] rounded-full bg-white shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] text-faint font-bold select-none">{portfoliosCount} {t('overview.portsCount')}</span>
                    <span className="text-[13px] font-bold text-dark tabular-nums select-none leading-none mt-0.5">
                      {formatAbbrMoney(totalAssets)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-[11.5px] font-semibold w-full px-2">
                  {portfolioSummaries
                    .filter((p) => p.valueThb > 0)
                    .map((p) => {
                      const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 text-dark/90 select-none">
                          <div
                            className="w-2.5 h-2.5 rounded-full shadow-sm"
                            style={{ backgroundColor: palette[p.color % 6] }}
                          ></div>
                          <span>{p.name}</span>
                          <span className="ml-auto font-bold tabular-nums text-dark">
                            {p.pctOfTotal.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Asset P&L Bars */}
            <div className="p-5 md:p-6 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-inputBorder/20">
              <h3 className="text-[15px] font-bold text-dark">{t('overview.unrealizedPl')}</h3>
              {barChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-[200px] text-muted text-xs.5">
                  {t('overview.noUnrealizedPl')}
                </div>
              ) : (
                <div className="flex items-end justify-around h-[220px] px-1 my-auto">
                  {barChartData.map((b, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end select-none">
                      <span className="text-[10px] font-bold text-center leading-[1.1] max-w-[40px]" style={{ color: b.isProfit ? '#4f7136' : '#b4543c' }}>
                        {b.valLabel}
                      </span>
                      <div
                        className="w-[28px] md:w-[34px] transition-all duration-300 shadow-sm"
                        style={{
                          height: `${b.heightPercent * 1.3}px`,
                          backgroundColor: b.color,
                          borderRadius: b.isProfit ? '4px 4px 0 0' : '0 0 4px 4px',
                        }}
                      ></div>
                      <span className="text-[10px] font-bold text-muted mt-1 text-center max-w-[40px] truncate">{b.symbol}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assets vs Liabilities */}
            <div className="bg-dark p-5 md:p-6 flex flex-col gap-4 text-[#faf5ec]">
              <h3 className="text-[15px] font-bold text-[#faf5ec]/90">{t('overview.assetsVsLiabilities')}</h3>
              <div className="flex flex-col gap-6 my-auto justify-center select-none pt-2">
                <div className="flex flex-col gap-2">
                  <div className="flex text-[12.5px] font-semibold text-[#cdbfa8]">
                    <span>{t('overview.assetsLabel')}</span>
                    <span className="ml-auto font-bold text-[#faf5ec]">{formatMoney(totalAssets)}</span>
                  </div>
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-[#a3b87a] rounded-full"></div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex text-[12.5px] font-semibold text-[#cdbfa8]">
                    <span>{t('overview.liabilitiesLabel')}</span>
                    <span className="ml-auto font-bold text-[#faf5ec]">{formatMoney(totalLiabilities)}</span>
                  </div>
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d98f70] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, Math.min(100, debtRatio))}%` }}
                    ></div>
                  </div>
                </div>

                <div className="border-t border-dashed border-white/10 pt-5 flex flex-col gap-1 mt-2">
                  <span className="text-[11.5px] text-[#cdbfa8] font-bold">{t('overview.debtRatio')}</span>
                  <div className="flex items-end gap-3 mt-0.5">
                    <span className="text-[28px] font-bold text-[#faf5ec] tabular-nums leading-none tracking-tight">{debtRatio.toFixed(1)}%</span>
                    <span className={`text-[12px] font-bold ${debtNoteColor} leading-[1.3]`}>{debtNoteText}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

