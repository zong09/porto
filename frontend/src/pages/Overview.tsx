import React from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useNetWorth, useAuthConfig } from '../hooks/useApi';
import { HelpCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useTranslation } from '../hooks/useTranslation';

// --- Squarify Treemap algorithm ---
interface Rect { x: number; y: number; w: number; h: number; }
function squarify<T>(items: { area: number; data: T }[], rect: Rect): ({ x: number; y: number; w: number; h: number; data: T })[] {
  const out: any[] = [];
  const worst = (areas: number[], side: number) => {
    let mx = -Infinity, mn = Infinity, sum = 0;
    for (const a of areas) { sum += a; if (a > mx) mx = a; if (a < mn) mn = a; }
    const s2 = side * side, sum2 = sum * sum;
    return Math.max((s2 * mx) / sum2, sum2 / (s2 * mn));
  };
  const lay = (row: any[], r: Rect) => {
    const sum = row.reduce((s, o) => s + o.area, 0);
    if (r.w <= r.h) {
      const rh = sum / r.w; let cx = r.x;
      for (const o of row) { const tw = o.area / rh; out.push({ x: cx, y: r.y, w: tw, h: rh, data: o.data }); cx += tw; }
      return { x: r.x, y: r.y + rh, w: r.w, h: Math.max(0, r.h - rh) };
    }
    const rw = sum / r.h; let cy = r.y;
    for (const o of row) { const th = o.area / rw; out.push({ x: r.x, y: cy, w: rw, h: th, data: o.data }); cy += th; }
    return { x: r.x + rw, y: r.y, w: Math.max(0, r.w - rw), h: r.h };
  };
  let r = { ...rect };
  let queue = [...items].sort((a, b) => b.area - a.area), row: any[] = [];
  while (queue.length) {
    const next = queue[0], side = Math.max(0.01, Math.min(r.w, r.h)), cur = row.map(o => o.area);
    if (row.length === 0 || worst(cur, side) >= worst(cur.concat(next.area), side)) {
      row.push(next); queue.shift();
    } else { r = lay(row, r); row = []; }
  }
  if (row.length) lay(row, r);
  return out;
}

export const Overview: React.FC = () => {
  const { currency, setPage, openModal } = useStore();
  const { data: portfolios = [], isLoading: loadingPorts } = usePortfolios();
  const { data: assets = [], isLoading: loadingAssets } = useAssets();
  const { summary, history } = useNetWorth(365);
  const { data: config } = useAuthConfig();
  const { t, language } = useTranslation();

  const lastUpdatedTime = React.useMemo(() => {
    if (!summary.dataUpdatedAt) return '';
    const date = new Date(summary.dataUpdatedAt);
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  }, [summary.dataUpdatedAt]);

  const hasAssets = assets.length > 0;
  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatMoney = (val: number, twoLines = false, forcePlusSign = false, alignRight = false) => {
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

    let sign = '';
    if (isNeg) {
      sign = '-';
    } else if (forcePlusSign && val > 0) {
      sign = '+';
    }

    if (twoLines) {
      return (
        <span className={`flex flex-col tabular-nums leading-snug ${alignRight ? 'items-end' : ''}`}>
          <span>{sign}{primary}</span>
          <span className="text-[0.68em] text-faint font-semibold mt-0.5">
            ({sign}{secondary})
          </span>
        </span>
      );
    }

    return (
      <span className="tabular-nums">
        {sign}{primary}
        <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
          ({sign}{secondary})
        </span>
      </span>
    );
  };

  // 1. Current Stats
  const totalAssets = summary.data?.totalAssetsThb || 0;
  const totalLiabilities = summary.data?.totalLiabilitiesThb || 0;
  const netWorth = summary.data?.netWorthThb || 0;
  const todayPl = summary.data?.todayPlThb || 0;

  const todayPlPct = React.useMemo(() => {
    if (!totalAssets || totalAssets <= 0) return 0;
    return (todayPl / totalAssets) * 100;
  }, [todayPl, totalAssets]);

  // 2. Month-over-Month Net Worth Change
  let MoMChangeLabel = '—';
  let MoMChangeUp = true;
  let MoMPct = 0;
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
      MoMPct = pct;
      MoMChangeLabel = `${pct >= 0 ? '▲ +' : '▼ -'}${Math.abs(pct).toFixed(1)}% ${t('overview.monthAbbr')}`;
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
    const ports = portfolios.map((p) => {
      const pAssets = assets.filter((a) => a.portfolioId === p.id);
      let pValueThb = 0;
      let pCostThb = 0;
      let pPlThb = 0;
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
        const avgCost = a.position.avgCost || 0;
        const currentPrice = a.currentPrice || 0;
        const assetCost = a.position.quantity * avgCost * multiplier;
        pCostThb += assetCost;

        const assetPl = isShort
          ? (avgCost - currentPrice) * a.position.quantity * multiplier
          : assetVal - assetCost;
        pPlThb += assetPl;

        types.add(typeLabels[a.type]);
      }

      const pReturnPct = pCostThb > 0 ? (pPlThb / pCostThb) * 100 : 0;
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
    // Sort descending by value
    return ports.sort((a, b) => b.valueThb - a.valueThb);
  }, [portfolios, assets, totalAssets, fx, language]);

  // 5. Treemap data calculations
  const treemapData = React.useMemo(() => {
    const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
    const tints = ['#EFF3E6', '#F3E9DC', '#F2E0D8', '#E2EDEA', '#EAE4F0', '#F2E2E8'];

    const portGroups = portfolios.map(p => {
      const pAssets = assets.filter(a => a.portfolioId === p.id && a.position && a.position.quantity > 0);
      const items = pAssets.map(a => {
        const multiplier = a.currency === 'USD' ? fx : 1;
        const isShort = (a.direction || 'long') === 'short';
        const val = a.position!.quantity * (a.currentPrice || 0) * multiplier;
        return { ...a, valueThb: isShort ? Math.abs(val) : val };
      }).filter(a => a.valueThb > 0).sort((a, b) => b.valueThb - a.valueThb);

      const totalVal = items.reduce((sum, item) => sum + item.valueThb, 0);
      return { 
        id: p.id,
        name: p.name,
        color: p.color,
        hexColor: palette[p.color % 6],
        tintColor: tints[p.color % 6],
        items,
        valueThb: totalVal 
      };
    }).filter(g => g.valueThb > 0).sort((a, b) => b.valueThb - a.valueThb);

    const globalTotal = portGroups.reduce((sum, g) => sum + g.valueThb, 0);

    // Run layout algorithms
    const W = 100;
    const H = 100;
    
    let groupRects: any[] = [];
    if (globalTotal > 0) {
      const gScale = (W * H) / globalTotal;
      const gItems = portGroups.map(g => ({ area: g.valueThb * gScale, data: g }));
      groupRects = squarify(gItems, { x: 0, y: 0, w: W, h: H });
    }
    
    const allLeaves: any[] = [];
    for (const grp of groupRects) {
      const gData = grp.data;
      // Calculate leaves inside this group rect
      const pad = 0.4; // 2px horizontal padding = 0.4% of 500px width
      const headHeight = 4.8; // 24px header height = 4.8% of 500px height
      const innerRect = {
        x: grp.x + pad,
        y: grp.y + headHeight,
        w: Math.max(0.1, grp.w - pad * 2),
        h: Math.max(0.1, grp.h - headHeight - pad)
      };
      
      if (gData.valueThb > 0) {
        const lScale = (innerRect.w * innerRect.h) / gData.valueThb;
        
        // Setup rank map for color gradients
        const sortedItems = [...gData.items].sort((a: any, b: any) => b.valueThb - a.valueThb);
        const rankMap = new Map();
        sortedItems.forEach((r, idx) => rankMap.set(r, idx));
        const gcount = sortedItems.length;

        const hex2rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const mix = (h: string, t: string, amt: number) => { 
          const a = hex2rgb(h), b = hex2rgb(t); 
          return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, '0')).join(''); 
        };

        const lItems = gData.items.map((it: any) => ({ area: it.valueThb * lScale, data: it }));
        const leafRects = squarify(lItems, innerRect);
        
        allLeaves.push(...leafRects.map(l => {
          const rank = rankMap.get(l.data) || 0;
          const amt = gcount > 1 ? (rank / (gcount - 1)) * 0.5 : 0;
          const leafTint = mix(gData.hexColor, '#ffffff', amt);

          return Object.assign({}, l.data, l, { 
            groupColor: leafTint, 
            groupTint: gData.tintColor 
          });
        }));
      }
    }

    return { groups: groupRects.map(g => Object.assign({}, g.data, g)), leaves: allLeaves, globalTotal };
  }, [assets, portfolios, fx]);

  // 6. All Assets table data
  const allAssetsTable = React.useMemo(() => {
    const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];

    const rows = assets
      .filter((a) => a.position && a.position.quantity > 0)
      .map((a) => {
        const multiplier = a.currency === 'USD' ? fx : 1;
        const isShort = (a.direction || 'long') === 'short';
        const assetVal = a.position!.quantity * (a.currentPrice || 0) * multiplier;
        const valueThb = isShort ? -assetVal : assetVal;
        const costThb = a.position!.quantity * (a.position!.avgCost || 0) * multiplier;
        const plThb = isShort ? (costThb - assetVal) : (valueThb - costThb);
        const returnPct = costThb > 0 ? (plThb / costThb) * 100 : 0;
        const weightPct = totalAssets > 0 ? (Math.abs(valueThb) / totalAssets) * 100 : 0;

        const portfolio = portfolios.find((p) => p.id === a.portfolioId);

        return {
          id: a.id,
          symbol: a.symbol,
          name: a.name || a.symbol,
          type: a.type,
          currency: a.currency,
          portfolioName: portfolio?.name || '—',
          portfolioColor: palette[(portfolio?.color || 0) % 6],
          currentPrice: a.currentPrice || 0,
          valueThb,
          change24h: a.change24h || 0,
          returnPct,
          weightPct,
        };
      })
      .sort((a, b) => Math.abs(b.valueThb) - Math.abs(a.valueThb));

    return rows;
  }, [assets, portfolios, totalAssets, fx]);

  const getSparkline = (symbol: string, isPositive: boolean) => {
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };

    const pts = 20;
    const w = 80;
    const h = 28;
    const trend = isPositive ? -0.3 : 0.3;
    const vals: number[] = [];
    let v = 0.5;
    for (let i = 0; i < pts; i++) {
      v += (random() - 0.5) * 0.3 + trend * (1 / pts);
      v = Math.max(0.05, Math.min(0.95, v));
      vals.push(v);
    }

    const points = vals.map((val, i) => {
      const x = (i / (pts - 1)) * w;
      const y = h - val * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M${points.join(' L')}`;
  };

  const formatPrice = (price: number, ccy: 'THB' | 'USD') => {
    if (price === 0) return '—';
    const sign = ccy === 'USD' ? '$' : '฿';
    return sign + price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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
          {todayPl !== 0 && (
            <div
              className={`px-3 py-0.5 rounded-full font-bold select-none ${
                todayPl >= 0 ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
              }`}
            >
              {todayPl >= 0 ? '+' : ''}
              {isThb
                ? `฿${todayPl.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : `$${(todayPl / fx).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              {' '}({todayPlPct >= 0 ? '+' : ''}{todayPlPct.toFixed(1)}%)
            </div>
          )}
          <div
            className={`px-3 py-0.5 rounded-full font-bold select-none ${
              MoMChangeUp ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
            }`}
          >
            {MoMChangeLabel}
          </div>
          <div className="text-faint select-none">
            {language === 'th' ? `อัปเดตล่าสุด ${lastUpdatedTime}` : `Last updated ${lastUpdatedTime}`}
          </div>
        </div>
      </div>

      {/* 2. Mini Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 max-w-[650px] mx-auto w-full px-2">
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.totalAssets')}</span>
          <span className="text-lg.5 font-bold text-dark tabular-nums">{formatMoney(totalAssets, true)}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.liabilities')}</span>
          <span className="text-lg.5 font-bold text-[#84422e] tabular-nums">{formatMoney(totalLiabilities, true)}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm border border-inputBorder/20">
          <span className="text-xs font-semibold text-muted">{t('overview.todayPl')}</span>
          <span
            className={`text-lg.5 font-bold tabular-nums ${
              todayPl >= 0 ? 'text-positive-text' : 'text-negative-text'
            }`}
          >
            {formatMoney(todayPl, true, true)}
          </span>
        </div>
      </div>

      {/* 3. Net Worth Area Chart */}
      {chartHistoryPoints.length >= 2 && (
        <div className="bg-white rounded-[24px] p-6 border border-inputBorder/20 shadow-sm mt-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-dark">{t('overview.netWorthGrowth')}</h3>
            <span
              className={`text-sm font-bold ${MoMChangeUp ? 'text-positive-text' : 'text-negative-text'}`}
            >
              {MoMPct >= 0 ? '▲' : '▼'} {Math.abs(MoMPct).toFixed(1)}%
            </span>
          </div>
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

      {/* Content Grid */}
      {hasAssets && (
        <>
          {/* 5. Portfolio Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {portfolioSummaries.map((c) => {
              const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
              const tints = ['#EFF3E6', '#F3E9DC', '#F2E0D8', '#E2EDEA', '#EAE4F0', '#F2E2E8'];
              const i = c.color;

              return (
                <div
                  key={c.id}
                  onClick={() => setPage('ports')}
                  className="rounded-[24px] p-6 flex flex-col shadow-sm border border-inputBorder/10 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
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
                  <span className="text-[26px] font-bold text-dark tabular-nums tracking-tight mb-1">
                    {formatMoney(c.valueThb, true)}
                  </span>
                  <p className="text-[11.5px] text-muted font-medium mb-5">{c.desc}</p>
                  
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

          {/* 6. Treemap Chart */}
          <div className="bg-white rounded-[24px] p-6 border border-inputBorder/20 shadow-sm mt-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-3 gap-2">
              <div className="flex items-baseline gap-3">
                <h3 className="text-[15px] font-bold text-dark">{t('overview.assetOverview')}</h3>
                <span className="text-[12px] text-muted">{t('overview.treemapLegend')}</span>
              </div>
              <span className="text-[12px] text-muted font-semibold">{assets.filter(a => a.position && a.position.quantity > 0).length} {t('overview.itemsCount')}</span>
            </div>

            {/* Treemap Container */}
            <div className="relative w-full h-[500px] mt-2 overflow-hidden rounded-[8px]">
              {/* Group borders/backgrounds */}
              {treemapData.groups.map(g => (
                <div 
                  key={`group-${g.id}`} 
                  className="absolute box-border border-2 rounded-[10px] overflow-hidden"
                  style={{
                    left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, height: `${g.h}%`,
                    borderColor: g.hexColor,
                    backgroundColor: g.tintColor,
                    padding: '4px 9px'
                  }}
                >
                  <div className="flex items-baseline gap-[7px] whitespace-nowrap overflow-hidden">
                    <span className="text-[12.5px] font-bold truncate" style={{ color: g.hexColor }}>{g.name}</span>
                    <span className="text-[11px] font-semibold text-[#8a7d6c] tabular-nums flex items-baseline">
                      {isThb ? '฿' : '$'}{isThb ? formatMoney(g.valueThb) : formatMoney(g.valueThb / fx)}
                      <span className="text-[0.72em] opacity-70 ml-[5px]">
                        ({!isThb ? '฿' : '$'}{!isThb ? formatMoney(g.valueThb) : formatMoney(g.valueThb / fx)})
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#8a7d6c] tabular-nums">
                      {((g.valueThb / treemapData.globalTotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {/* Asset leaves */}
              {treemapData.leaves.map(l => {
                const isShort = (l.direction || 'long') === 'short';
                const dispVal = isThb ? l.valueThb : l.valueThb / fx;
                const secondaryDispVal = !isThb ? l.valueThb : l.valueThb / fx;
                const sign = isThb ? '฿' : '$';
                const secondarySign = !isThb ? '฿' : '$';
                const pct = (l.valueThb / treemapData.globalTotal) * 100;
                const formatShortVal = (val: number) => val >= 1000 ? (val/1000).toFixed(val >= 10000 ? 0 : 1)+'k' : val.toFixed(0);
                // Only show text if box is large enough
                const showSym = l.w > 4 && l.h > 4;
                const showVal = l.w > 8 && l.h > 12;
                const showPct = l.w > 6 && l.h > 18;

                return (
                  <div 
                    key={`leaf-${l.id}`} 
                    className="absolute box-border border-[1.5px] border-white/90 rounded-[5px] flex flex-col items-start justify-start overflow-hidden transition-all duration-200 hover:brightness-95 cursor-pointer"
                    style={{
                      left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`,
                      backgroundColor: l.groupColor,
                      padding: showVal ? '6px 8px' : '3px 5px',
                      gap: '1px'
                    }}
                    title={`${l.symbol} \n${l.name}\n${sign}${dispVal.toLocaleString('en-US', {maximumFractionDigits: 0})}\n${pct.toFixed(1)}%`}
                  >
                    {showSym && <span className="font-bold text-white text-[10px] sm:text-[14px] leading-[1.1] truncate max-w-full drop-shadow-sm">{l.symbol}</span>}
                    {showVal && <div className="flex items-baseline text-[11px] text-white/95 font-medium tabular-nums truncate max-w-full drop-shadow-sm">
                      <span>{isShort ? '-' : ''}{sign}{formatShortVal(dispVal)}</span>
                      <span className="text-[0.8em] text-white/70 ml-1">
                        ({isShort ? '-' : ''}{secondarySign}{formatShortVal(secondaryDispVal)})
                      </span>
                    </div>}
                    {showPct && <span className="text-[10.5px] text-white/90 font-bold tabular-nums truncate max-w-full drop-shadow-sm">{pct.toFixed(1)}%</span>}
                  </div>
                );
              })}
            </div>

            {/* Treemap Legend */}
            <div className="flex flex-wrap gap-4 mt-4 px-1">
              {treemapData.groups.map(g => (
                <div key={`legend-${g.id}`} className="flex items-center gap-2 text-[12px] font-semibold text-muted">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.hexColor }}></div>
                  <span>{g.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 7. All Assets Table */}
          <div className="bg-white rounded-[24px] p-6 border border-inputBorder/20 shadow-sm mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-dark">{t('overview.allAssets')}</h3>
              <span className="text-[12px] text-muted font-semibold">
                {allAssetsTable.length} {t('overview.itemsCount')} · {t('overview.sortedByValue')}
              </span>
            </div>

            {/* Table Header */}
            <div className="grid items-center text-[11px] font-bold text-muted border-b border-inputBorder/20 pb-2.5 mb-1 select-none"
              style={{ gridTemplateColumns: '1.9fr 1.2fr 1fr 1.1fr 0.85fr 0.95fr 130px 104px' }}
            >
              <span>{t('overview.tableAsset')}</span>
              <span>{t('overview.tablePort')}</span>
              <span className="text-right">{t('overview.tablePrice')}</span>
              <span className="text-right">{t('overview.tableValue')}</span>
              <span className="text-right">{t('overview.tableToday')}</span>
              <span className="text-right">{t('overview.tableTotalReturn')}</span>
              <span className="text-center">{t('overview.table30d')}</span>
              <span className="text-right">{t('overview.tableWeight')}</span>
            </div>

            {/* Table Rows */}
            {allAssetsTable.map((row) => {
              const is24hUp = row.change24h >= 0;
              const isReturnUp = row.returnPct >= 0;

              return (
                <div
                  key={row.id}
                  className="grid items-center py-3 border-b border-inputBorder/10 last:border-b-0 hover:bg-chipBg/30 transition-colors"
                  style={{ gridTemplateColumns: '1.9fr 1.2fr 1fr 1.1fr 0.85fr 0.95fr 130px 104px' }}
                >
                  {/* Asset */}
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[13px] font-bold text-dark truncate">{row.symbol}</span>
                    <span className="text-[10.5px] text-muted truncate">{row.name}</span>
                  </div>

                  {/* Portfolio */}
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: row.portfolioColor }}
                    ></div>
                    <span className="text-[12.5px] text-dark/80 truncate">{row.portfolioName}</span>
                  </div>

                  {/* Price */}
                  <span className="text-[12.5px] text-dark tabular-nums text-right">
                    {formatPrice(row.currentPrice, row.currency)}
                  </span>

                  {/* Value */}
                  <span className="text-[13px] font-bold text-dark tabular-nums text-right">
                    {formatMoney(row.valueThb, true, false, true)}
                  </span>

                  {/* Today % */}
                  <span className={`text-[12.5px] font-bold tabular-nums text-right ${
                    row.change24h === 0 ? 'text-muted' : is24hUp ? 'text-positive-text' : 'text-negative-text'
                  }`}>
                    {row.change24h === 0 ? '—' : `${is24hUp ? '+' : ''}${row.change24h.toFixed(1)}%`}
                  </span>

                  {/* Total Return */}
                  <span className={`text-[12.5px] font-bold tabular-nums text-right ${
                    row.returnPct === 0 ? 'text-muted' : isReturnUp ? 'text-positive-text' : 'text-negative-text'
                  }`}>
                    {row.returnPct === 0 ? '—' : `${isReturnUp ? '+' : ''}${row.returnPct.toFixed(1)}%`}
                  </span>

                  {/* 30d Sparkline */}
                  <div className="flex justify-center">
                    <svg viewBox="0 0 130 30" className="w-[120px] h-[28px]">
                      <path
                        d={getSparkline(row.symbol, isReturnUp)}
                        fill="none"
                        stroke={isReturnUp ? '#7a8f55' : '#b45a3c'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Weight */}
                  <div className="flex flex-col gap-1 items-end justify-center h-full pl-2">
                    <span className="text-[11.5px] font-bold text-dark/80 tabular-nums leading-none">
                      {row.weightPct.toFixed(1)}%
                    </span>
                    <div className="w-[70px] h-[6px] bg-[#f3ede0] rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${Math.min(100, row.weightPct)}%`, backgroundColor: row.portfolioColor }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
