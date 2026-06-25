import React from 'react';
import { useStore } from '../store/useStore';
import { useLiabilities, useNetWorth } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const Liabilities: React.FC = () => {
  const { currency, openModal } = useStore();
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

  // Donut chart CSS conic gradient segments
  const debtPalette = ['#d98f70', '#c4654a', '#b4543c', '#e0a07a', '#a85d77', '#8f4630'];
  const donutGradient = React.useMemo(() => {
    let accum = 0;
    const segs: string[] = [];

    liabilities.forEach((l, index) => {
      if (totalLiabilities <= 0) return;
      const amountThb = l.currency === 'USD' ? Number(l.amount) * fx : Number(l.amount);
      const share = (amountThb / totalLiabilities) * 100;
      const nextAccum = accum + share;
      const color = debtPalette[index % 6];
      segs.push(`${color} ${accum.toFixed(2)}% ${nextAccum.toFixed(2)}%`);
      accum = nextAccum;
    });

    return segs.length > 0 ? `conic-gradient(${segs.join(', ')})` : '#f0e7d8';
  }, [liabilities, totalLiabilities, fx]);

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
      <div className="flex items-center justify-between gap-4 py-[18px] border-b border-inputBorder/20 flex-wrap">
        <h2 className="text-xl font-bold text-dark">{language === 'th' ? 'หนี้สิน' : 'Liabilities'}</h2>
        <button
          onClick={() => openModal('liability')}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm ml-auto"
          id="btn-add-debt-page"
        >
          {t('liabilities.addBtn')}
        </button>
      </div>

      {/* Summary Strip (Dark Theme style) */}
      <div className="bg-dark rounded-[20px] px-8 py-7 grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-center mt-6 text-[#faf5ec] shadow-md border border-inputBorder/10 select-none">
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">{language === 'th' ? 'สินทรัพย์รวม' : 'Total Assets'}</span>
          <span className="text-[28px] leading-tight font-bold text-[#a3b87a] tabular-nums">{formatMoney(totalAssets)}</span>
        </div>
        <span className="text-2xl text-[#cdbfa8]/40 font-light select-none">—</span>
        <div className="flex flex-col gap-1 pl-4">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">{language === 'th' ? 'หนี้สินรวม' : 'Total Liabilities'}</span>
          <span className="text-[28px] leading-tight font-bold text-[#d98f70] tabular-nums">{formatMoney(totalLiabilities)}</span>
        </div>
        <span className="text-2xl text-[#cdbfa8]/40 font-light select-none">=</span>
        <div className="flex flex-col gap-1 pl-4">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">Net Worth</span>
          <span className="text-[28px] leading-tight font-bold text-white tabular-nums">{formatMoney(netWorth)}</span>
        </div>
      </div>

      {/* Debt Composition Donut */}
      {hasLiabilities && (
        <div className="bg-white rounded-[20px] p-8 border border-inputBorder/20 shadow-sm flex items-center justify-start gap-10 flex-wrap mt-6">
          <div className="relative w-[130px] h-[130px] shrink-0">
            <div
              className="w-[130px] h-[130px] rounded-full shadow-inner"
              style={{ background: donutGradient }}
            ></div>
            <div className="absolute inset-[22px] rounded-full bg-white shadow-sm flex flex-col items-center justify-center select-none">
              <span className="text-[10px] text-faint font-bold">{language === 'th' ? 'หนี้สินรวม' : 'Total Liabilities'}</span>
              <span className="text-[15px] font-bold text-dark tabular-nums leading-none mt-0.5">
                {formatMoney(totalLiabilities)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-[220px] flex flex-col gap-3">
            <h3 className="text-sm font-bold text-dark select-none">{language === 'th' ? 'สัดส่วนหนี้สิน' : 'Debt Allocation'}</h3>
            <div className="flex flex-col gap-2 font-semibold text-[13px] text-dark/90 select-none">
              {liabilities.map((l, index) => {
                const amountThb = l.currency === 'USD' ? Number(l.amount) * fx : Number(l.amount);
                const share = totalLiabilities > 0 ? (amountThb / totalLiabilities) * 100 : 0;
                return (
                  <div key={l.id} className="flex items-center gap-2 select-none">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: debtPalette[index % 6] }}></div>
                    <span>{l.name}</span>
                    <span className="ml-auto font-bold tabular-nums">{formatNativePrimary(Number(l.amount), l.currency as 'THB' | 'USD')}</span>
                    <span className="w-[38px] text-right text-faint font-semibold text-[11px] tabular-nums">{share.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasLiabilities && (
        <div className="bg-white border border-inputBorder/25 rounded-[20px] p-10 text-center flex flex-col items-center gap-3 mt-6">
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
            className="bg-white rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 border border-inputBorder/15 hover:border-inputBorder/30 shadow-sm transition-all duration-150"
          >
            <div className="flex items-center gap-3 select-none">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: debtPalette[index % 6] }}></div>
              <span className="text-[13.5px] font-bold text-dark">{l.name}</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[14.5px] font-bold text-dark tabular-nums">
                  {formatNativePrimary(Number(l.amount), l.currency as 'THB' | 'USD')}
                </span>
                <span className="text-[0.72em] text-faint font-semibold tabular-nums">
                  ({formatNativeSecondary(Number(l.amount), l.currency as 'THB' | 'USD')})
                </span>
              </div>
              <button
                onClick={() => handleDelete(l.id, l.name)}
                className="bg-transparent border-none text-[#c9bca5] hover:text-negative-text cursor-pointer transition-colors p-1"
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

