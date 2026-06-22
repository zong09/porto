import React from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useNetWorth } from '../hooks/useApi';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export const Portfolios: React.FC = () => {
  const { currency, openModal } = useStore();
  const { data: portfolios = [], deletePortfolio, isLoading: loadingPorts } = usePortfolios();
  const { data: assets = [], deleteAsset, isLoading: loadingAssets } = useAssets();
  const { summary } = useNetWorth();
  const { t, language } = useTranslation();

  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatMoneyPrimary = (val: number, nativeCcy?: 'THB' | 'USD') => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);
    // When nativeCcy is given, primary follows the asset's own currency; otherwise the global display.
    const useThb = nativeCcy ? nativeCcy === 'THB' : isThb;

    if (useThb) {
      const formatted = absThb.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}฿${formatted}`;
    } else {
      const formatted = absUsd.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}$${formatted}`;
    }
  };

  const formatMoneySecondary = (val: number, nativeCcy?: 'THB' | 'USD') => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);
    const useThb = nativeCcy ? nativeCcy === 'THB' : isThb;

    if (useThb) {
      const formatted = absUsd.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}$${formatted}`;
    } else {
      const formatted = absThb.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}฿${formatted}`;
    }
  };

  const formatMoney = (val: number) => {
    const primary = formatMoneyPrimary(val);
    const secondary = formatMoneySecondary(val);
    return (
      <span className="tabular-nums">
        {primary}
        <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
          ({secondary})
        </span>
      </span>
    );
  };

  const formatNativePrimary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    // Primary shows the asset's own native currency, regardless of global display.
    if (ccy === 'THB') {
      const decimalLimit = 2;
      return '฿' + thb.toLocaleString('en-US', {
        minimumFractionDigits: decimalLimit,
        maximumFractionDigits: decimalLimit,
      });
    } else {
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  };

  const formatNativeSecondary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    // Secondary shows the converted (non-native) currency in parentheses.
    if (ccy === 'THB') {
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      const decimalLimit = 2;
      return '฿' + thb.toLocaleString('en-US', {
        minimumFractionDigits: decimalLimit,
        maximumFractionDigits: decimalLimit,
      });
    }
  };


  const formatQty = (qty: number, type: string) => {
    if (type === 'deposit') return `฿${qty.toLocaleString('en-US')}`;
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  };

  const handleDeletePortfolio = async (id: string, name: string) => {
    const portfolioAssets = assets.filter((a) => a.portfolioId === id);
    if (portfolioAssets.length > 0) {
      alert(
        language === 'th'
          ? 'ไม่สามารถลบพอร์ตได้เนื่องจากยังมีสินทรัพย์เหลืออยู่ภายในพอร์ต กรุณาลบสินทรัพย์ทั้งหมดก่อน'
          : 'Cannot delete portfolio because it still contains assets. Please delete all assets first.'
      );
      return;
    }
    if (
      confirm(
        language === 'th'
          ? `คุณต้องการลบพอร์ต "${name}" ใช่หรือไม่?`
          : `Are you sure you want to delete portfolio "${name}"?`
      )
    ) {
      try {
        await deletePortfolio.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  const handleDeleteAsset = async (id: string, symbol: string) => {
    if (
      confirm(
        language === 'th'
          ? `คุณต้องการลบสินทรัพย์ "${symbol}" และรายการธุรกรรมทั้งหมดที่เกี่ยวข้องใช่หรือไม่?`
          : `Are you sure you want to delete asset "${symbol}" and all related transactions?`
      )
    ) {
      try {
        await deleteAsset.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  if (loadingPorts || loadingAssets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">
          {language === 'th' ? 'กำลังโหลดข้อมูลพอร์ต…' : 'Loading portfolios...'}
        </span>
      </div>
    );
  }

  const portfolioSections = portfolios.map((p) => {
    const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
    const pAssets = assets.filter((a) => a.portfolioId === p.id);

    // Compute portfolio value and cost
    let pValueThb = 0;
    let pCostThb = 0;
    const holdings = pAssets.map((a) => {
      const multiplier = a.currency === 'USD' ? fx : 1;
      const quantity = a.position?.quantity || 0;
      const currentPrice = a.currentPrice || 0;
      const avgCost = a.position?.avgCost || 0;

      const assetValueThb = quantity * currentPrice * multiplier;
      const assetCostThb = quantity * avgCost * multiplier;
      
      pValueThb += assetValueThb;
      pCostThb += assetCostThb;

      const plThb = assetValueThb - assetCostThb;
      const returnPct = avgCost > 0 ? (plThb / assetCostThb) * 100 : 0;

      return {
        ...a,
        quantity,
        avgCost,
        currentPrice,
        valueThb: assetValueThb,
        plThb,
        returnPct,
      };
    });

    const pReturnPct = pCostThb > 0 ? ((pValueThb - pCostThb) / pCostThb) * 100 : 0;
    const activeHoldings = holdings.filter((h) => h.quantity > 0).sort((a, b) => b.valueThb - a.valueThb);

    // Stacked allocation bar config
    const allocationSegments = activeHoldings.map((h, idx) => ({
      width: pValueThb > 0 ? `${(h.valueThb / pValueThb) * 100}%` : '0%',
      color: palette[idx % 6],
    }));

    const allocationLegend = activeHoldings.map((h, idx) => ({
      symbol: h.symbol,
      pct: pValueThb > 0 ? (h.valueThb / pValueThb) * 100 : 0,
      color: palette[idx % 6],
    }));

    const hasAllocation = activeHoldings.length >= 2;

    return {
      ...p,
      holdings,
      valueThb: pValueThb,
      returnPct: pReturnPct,
      hasHoldings: holdings.length > 0,
      hasAllocation,
      allocationSegments,
      allocationLegend,
      colorHex: palette[p.color % 6],
    };
  });

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Portfolios">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-4.5 border-b border-inputBorder/20 flex-wrap">
        <h2 className="text-xl font-bold text-dark">{t('portfolios.title')}</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => openModal('asset')}
            className="px-5 py-2 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-xs font-bold border-none cursor-pointer transition-colors shadow-sm"
            id="btn-add-asset-top"
          >
            {t('portfolios.addAssetBtn')}
          </button>
          <button
            onClick={() => openModal('portfolio')}
            className="px-5 py-2 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold border-none cursor-pointer transition-colors shadow-sm"
            id="btn-create-port-top"
          >
            {t('portfolios.createBtn')}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {portfolios.length === 0 && (
        <div className="bg-white border border-inputBorder/25 rounded-2.5xl p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-sm.5 text-muted">
            {language === 'th'
              ? 'ยังไม่มีพอร์ตการลงทุนในระบบ กด "+ สร้างพอร์ต" เพื่อเริ่มต้น'
              : 'No portfolios found. Click "+ Create Portfolio" to start.'}
          </span>
        </div>
      )}

      {/* Portfolios List */}
      <div className="flex flex-col gap-5 mt-6">
        {portfolioSections.map((p) => {
          return (
            <div key={p.id} className="bg-white rounded-2.5xl p-5 border border-inputBorder/20 shadow-sm flex flex-col gap-4">
              {/* Portfolio header info */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.colorHex }}></div>
                <span className="text-md.5 font-bold text-dark">{p.name}</span>
                <span className="text-base font-bold text-dark tabular-nums ml-1">
                  {formatMoney(p.valueThb)}
                </span>
                {p.valueThb > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full select-none ${
                      p.returnPct >= 0 ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
                    }`}
                  >
                    {p.returnPct >= 0 ? '+' : ''}
                    {p.returnPct.toFixed(1)}%
                  </span>
                )}
                
                {/* Actions */}
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => openModal('asset', { portfolioId: p.id })}
                    className="px-3.5 py-1.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[11.5px] font-bold border-none cursor-pointer transition-colors"
                  >
                    + {language === 'th' ? 'สินทรัพย์' : 'Asset'}
                  </button>
                  <button
                    onClick={() => handleDeletePortfolio(p.id, p.name)}
                    className="bg-transparent border-none text-faint-darker hover:text-negative-text cursor-pointer text-[12px] font-semibold transition-colors flex items-center gap-0.5"
                  >
                    <Trash2 size={12} />
                    <span>{t('common.delete')}</span>
                  </button>
                </div>
              </div>

              {/* Allocation stacked bar */}
              {p.hasAllocation && (
                <div className="flex flex-col gap-2 border-t border-inputBorder/10 pt-4">
                  <div className="flex h-3 rounded-full overflow-hidden bg-[#f7f0e3]">
                    {p.allocationSegments.map((s, idx) => (
                      <div key={idx} className="h-full" style={{ width: s.width, backgroundColor: s.color }}></div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1.5">
                    {p.allocationLegend.map((legend, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold select-none">
                        <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: legend.color }}></div>
                        <span className="text-dark/95">{legend.symbol}</span>
                        <span className="text-faint-darker">{legend.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Holdings list */}
              {!p.hasHoldings ? (
                <span className="text-xs.5 text-faint-darker font-medium py-2">{t('portfolios.noAssetsInPort')}</span>
              ) : (
                <div className="overflow-x-auto border-t border-inputBorder/10 pt-4 mt-2">
                  <table className="min-w-[860px] w-full border-collapse">
                    <thead>
                      <tr className="grid grid-cols-[1.8fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_245px] gap-2.5 px-3 py-2 text-[11.5px] font-bold text-faint-darker border-b border-inputBorder/20 text-left">
                        <th>{language === 'th' ? 'สินทรัพย์' : 'Asset'}</th>
                        <th className="text-right">{t('portfolios.tableQty')}</th>
                        <th className="text-right">{t('portfolios.tableAvgCost')}</th>
                        <th className="text-right">{t('portfolios.tablePrice')}</th>
                        <th className="text-right">{t('portfolios.tableValue')}</th>
                        <th className="text-right">{t('portfolios.tablePl')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col gap-1 mt-1">
                      {p.holdings.map((h) => {
                        const isDep = h.type === 'deposit';
                        const isUp = h.plThb >= 0;

                        return (
                          <tr
                            key={h.id}
                            className="grid grid-cols-[1.8fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_245px] gap-2.5 px-3 py-3 items-center rounded-xl hover:bg-surface transition-colors duration-150 border-b border-[#f7f0e3] last:border-none"
                          >
                            <td className="flex flex-col select-none">
                              <span className="font-bold text-dark leading-none">{h.symbol}</span>
                              <span className="text-[11px] text-faint font-semibold mt-1">
                                {h.name && h.name !== h.symbol ? `${h.name}` : h.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="text-right font-bold tabular-nums text-dark/90 text-sm">
                              {formatQty(h.quantity, h.type)}
                            </td>
                            <td className="text-right tabular-nums flex flex-col items-end">
                              {isDep ? (
                                <span className="font-semibold text-muted text-xs.5">—</span>
                              ) : (
                                <>
                                  <span className="font-semibold text-muted text-xs.5">{formatNativePrimary(h.avgCost, h.currency)}</span>
                                  <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(h.avgCost, h.currency)}</span>
                                </>
                              )}
                            </td>
                            <td className="text-right tabular-nums flex flex-col items-end">
                              {isDep ? (
                                <span className="font-semibold text-dark/95 text-xs.5">—</span>
                              ) : (
                                <>
                                  <span className="font-semibold text-dark/95 text-xs.5">{formatNativePrimary(h.currentPrice, h.currency)}</span>
                                  <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(h.currentPrice, h.currency)}</span>
                                </>
                              )}
                            </td>
                            <td className="text-right tabular-nums flex flex-col items-end">
                              <span className="font-bold text-dark text-sm">{formatMoneyPrimary(h.valueThb, h.currency)}</span>
                              <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatMoneySecondary(h.valueThb, h.currency)}</span>
                            </td>
                            <td className="text-right tabular-nums flex flex-col items-end">
                              {isDep ? (
                                <span className="font-bold text-faint text-xs.5">—</span>
                              ) : (
                                <>
                                  <span className={`font-bold text-xs.5 ${isUp ? 'text-positive-text' : 'text-negative-text'}`}>
                                    {isUp ? '+' : ''}{formatMoneyPrimary(h.plThb, h.currency)}
                                  </span>
                                  <span className="text-[10.5px] text-faint font-bold mt-0.5">
                                    {isUp ? '+' : ''}{formatMoneySecondary(h.plThb, h.currency)}
                                  </span>
                                </>
                              )}
                            </td>
                            <td className="flex justify-end gap-1.5">
                              <button
                                onClick={() => openModal('tx', { assetId: h.id })}
                                className="px-3 py-1.5 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[11px] font-bold border-none cursor-pointer transition-colors shadow-sm"
                              >
                                {language === 'th' ? 'ซื้อ/ขาย' : 'Buy/Sell'}
                              </button>
                              {h.type !== 'fund' && h.type !== 'deposit' && (
                                <button
                                  onClick={() => openModal('chart', { assetId: h.id })}
                                  className="px-3 py-1.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[11px] font-bold border-none cursor-pointer transition-colors"
                                >
                                  {language === 'th' ? 'กราฟ' : 'Chart'}
                                </button>
                              )}
                              {h.type === 'fund' && (
                                <button
                                  onClick={() => openModal('price', { assetId: h.id })}
                                  className="px-3 py-1.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[11px] font-bold border-none cursor-pointer transition-colors"
                                >
                                  NAV
                                </button>
                              )}
                              <button
                                onClick={() => openModal('asset', { assetId: h.id })}
                                className="bg-transparent border-none text-[#c9bca5] hover:text-terracotta cursor-pointer transition-colors p-1"
                                title={language === 'th' ? 'แก้ไข' : 'Edit'}
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(h.id, h.symbol)}
                                className="bg-transparent border-none text-[#c9bca5] hover:text-negative-text cursor-pointer transition-colors p-1"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

