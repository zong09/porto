import React from 'react';
import { useStore } from '../store/useStore';
import { useLiabilities, useNetWorth } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';
import { computeSankey } from '../utils/sankey';
import { SankeyCard } from '../components/SankeyCard';
import { useThemePalette } from '../utils/themes';

export const Liabilities: React.FC = () => {
  const { currency, openModal } = useStore();
  const themeColors = useThemePalette();
  const { data: liabilities = [], deleteLiability, isLoading } = useLiabilities();
  const { summary } = useNetWorth();
  const { t, language } = useTranslation();

  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatMoney = (val: number, showSecondary: boolean = false) => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);

    const usdStr = '$' + absUsd.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const thbStr = '฿' + absThb.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const primary = isThb ? thbStr : usdStr;
    const secondary = isThb ? usdStr : thbStr;

    return (
      <span className="tabular-nums">
        {isNeg ? '-' : ''}{primary}
        {showSecondary && (
          <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
            ({isNeg ? '-' : ''}{secondary})
          </span>
        )}
      </span>
    );
  };

  const formatNativePrimary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    const str = isUSD
      ? '$' + absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '฿' + absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (isNeg ? '-' : '') + str;
  };

  const formatNativeSecondary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const converted = isUSD ? val * fx : val / fx;
    const isNeg = converted < 0;
    const absVal = Math.abs(converted);
    const str = isUSD
      ? '฿' + absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$' + absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (isNeg ? '-' : '') + str;
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      confirm(
        language === 'th'
          ? `คุณต้องการลบรายการหนี้สิน "${name}" ใช่หรือไม่?`
          : `Are you sure you want to delete liability "${name}"?`
      )
    ) {
      try {
        await deleteLiability.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  // Math totals
  const totalAssets = summary.data?.totalAssetsThb || 0;
  const totalLiabilities = summary.data?.totalLiabilitiesThb || 0;
  const netWorth = summary.data?.netWorthThb || 0;

  const debtPalette = themeColors.debtPalette;

  // Plain currency-aware base-THB formatter for chart node labels
  const plainMoney = (thb: number) =>
    isThb
      ? '฿' + thb.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : '$' + (thb / fx).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Liability Sankey: each debt (left) → Total Liabilities (right)
  const liabSankey = React.useMemo(() => {
    const items = liabilities
      .map((l) => ({ l, amountThb: l.currency === 'USD' ? Number(l.amount) * fx : Number(l.amount) }))
      .filter((x) => x.amountThb > 0)
      .sort((a, b) => b.amountThb - a.amountThb);
    if (!items.length) return null;
    const leftTotal = items.reduce((s, x) => s + x.amountThb, 0);
    const left = items.map((x, i) => ({
      label: x.l.name,
      sub: `${plainMoney(x.amountThb)} · ${((x.amountThb / leftTotal) * 100).toFixed(1)}%`,
      color: debtPalette[i % 6],
      value: x.amountThb,
    }));
    const right = [
      { label: language === 'th' ? 'หนี้สินรวม' : 'Total Debt', sub: plainMoney(leftTotal), color: 'var(--loss-d)', value: leftTotal },
    ];
    const flows = items.map((_, i) => ({ leftIndex: i, rightIndex: 0, value: left[i].value }));
    return computeSankey({ left, right, flows, SW: 1000, SH: 420, LX: 150, RX: 1000 - 150 - 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liabilities, fx, isThb, language, themeColors]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">{t('liabilities.loadingLiabilities')}</span>
      </div>
    );
  }

  const hasLiabilities = liabilities.length > 0;

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Liabilities">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pt-[28px] pb-[18px] border-b border-inputBorder/20 flex-wrap">
        <h2 className="text-[22px] font-bold text-dark">{language === 'th' ? 'หนี้สิน' : 'Liabilities'}</h2>
        <button
          onClick={() => openModal('liability')}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm ml-auto"
          id="btn-add-debt-page"
        >
          {t('liabilities.addBtn')}
        </button>
      </div>

      {/* Summary Strip (Dark Theme style) */}
      <div className="bg-dark rounded-[22px] px-[28px] py-[24px] flex flex-wrap items-center gap-x-7 gap-y-3 mt-6 text-white shadow-md border border-inputBorder/10 select-none">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-white/60 font-bold">{language === 'th' ? 'สินทรัพย์รวม' : 'Total Assets'}</span>
          <span className="text-[24px] leading-tight font-bold text-positive-text tabular-nums">{formatMoney(totalAssets)}</span>
        </div>
        <span className="text-[22px] text-white/40 font-light select-none">—</span>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-white/60 font-bold">{language === 'th' ? 'หนี้สินรวม' : 'Total Liabilities'}</span>
          <span className="text-[24px] leading-tight font-bold text-secondary tabular-nums">{formatMoney(totalLiabilities)}</span>
        </div>
        <span className="text-[22px] text-white/40 font-light select-none">=</span>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-white/60 font-bold">Net Worth</span>
          <span className="text-[24px] leading-tight font-bold text-white tabular-nums">{formatMoney(netWorth)}</span>
        </div>
      </div>

      {/* Liability Sankey */}
      {hasLiabilities && liabSankey && (
        <SankeyCard
          title={language === 'th' ? 'สัดส่วนหนี้สิน' : 'Debt Allocation'}
          subtitle={language === 'th' ? 'แต่ละรายการ → หนี้สินรวม · ความหนา = ยอดหนี้' : 'each debt → total · width = balance'}
          height={440}
          viewW={1000}
          viewH={420}
          data={liabSankey}
        />
      )}

      {/* Empty State */}
      {!hasLiabilities && (
        <div className="bg-white border border-inputBorder/25 rounded-[22px] p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-[14.5px] text-muted">
            {language === 'th' ? 'ไม่มีหนี้สิน 🎉' : 'No liabilities 🎉'}
          </span>
        </div>
      )}

      {/* Liabilities List */}
      <div className="flex flex-col gap-2.5 mt-6">
        {liabilities.map((l, index) => (
          <div
            key={l.id}
            className="bg-white rounded-2xl px-[22px] py-[16px] flex items-center justify-between gap-4 border border-inputBorder/15 hover:border-inputBorder/30 shadow-sm transition-all duration-150"
          >
            <div className="flex items-center gap-3 select-none">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: debtPalette[index % 6] }}></div>
              <span className="text-[14.5px] font-bold text-dark">{l.name}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold text-dark tabular-nums">
                  {formatNativePrimary(Number(l.amount), l.currency as 'THB' | 'USD')}
                </span>
                <span className="text-[0.72em] text-faint font-semibold tabular-nums">
                  ({formatNativeSecondary(Number(l.amount), l.currency as 'THB' | 'USD')})
                </span>
              </div>
              <button
                onClick={() => openModal('liability', { liabilityId: l.id, liabilityMode: 'pay' })}
                className="px-[14px] py-[7px] rounded-[9px] border border-softH bg-white text-positive-text text-[12.5px] font-bold hover:bg-chipBg cursor-pointer transition-colors"
              >
                {language === 'th' ? 'จ่ายหนี้' : 'Pay'}
              </button>
              <button
                onClick={() => openModal('liability', { liabilityId: l.id, liabilityMode: 'add' })}
                className="px-[14px] py-[7px] rounded-[9px] border border-softH bg-white text-lossD text-[12.5px] font-bold hover:bg-chipBg cursor-pointer transition-colors"
              >
                {language === 'th' ? 'กู้เพิ่ม' : 'Add debt'}
              </button>
              <button
                onClick={() => openModal('liability', { liabilityId: l.id, liabilityMode: 'set' })}
                title={language === 'th' ? 'แก้ไขยอดสุทธิ' : 'Set balance'}
                className="px-[10px] py-[7px] rounded-[9px] border border-softH bg-white text-muted text-[12.5px] font-bold hover:bg-chipBg cursor-pointer transition-colors"
              >
                {language === 'th' ? 'แก้ไข' : 'Edit'}
              </button>
              <button
                onClick={() => handleDelete(l.id, l.name)}
                className="bg-transparent border-none text-faint hover:text-negative-text cursor-pointer transition-colors p-1"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

