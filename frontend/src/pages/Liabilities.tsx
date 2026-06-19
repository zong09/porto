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

  const formatMoney = (val: number) => {
    const converted = isThb ? val : val / fx;
    return (
      (isThb ? '฿' : '$') +
      converted.toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })
    );
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
      const share = (Number(l.amount) / totalLiabilities) * 100;
      const nextAccum = accum + share;
      const color = debtPalette[index % 6];
      segs.push(`${color} ${accum.toFixed(2)}% ${nextAccum.toFixed(2)}%`);
      accum = nextAccum;
    });

    return segs.length > 0 ? `conic-gradient(${segs.join(', ')})` : '#f0e7d8';
  }, [liabilities, totalLiabilities]);

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
      <div className="flex items-center justify-between gap-4 py-4.5 border-b border-inputBorder/20 flex-wrap">
        <h2 className="text-xl font-bold text-dark">{language === 'th' ? 'หนี้สินของฉัน' : 'My Liabilities'}</h2>
        <button
          onClick={() => openModal('liability')}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm ml-auto"
          id="btn-add-debt-page"
        >
          {t('liabilities.addBtn')}
        </button>
      </div>

      {/* Summary Strip (Dark Theme style) */}
      <div className="bg-dark rounded-2.5xl p-6 flex justify-between gap-6 flex-wrap items-center mt-6 text-[#faf5ec] shadow-md border border-inputBorder/10 select-none">
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">{t('overview.assetsLabel')}</span>
          <span className="text-2xl font-bold text-[#a3b87a] tabular-nums">{formatMoney(totalAssets)}</span>
        </div>
        <span className="text-2xl text-muted select-none">—</span>
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">{t('overview.liabilitiesLabel')}</span>
          <span className="text-2xl font-bold text-[#d98f70] tabular-nums">{formatMoney(totalLiabilities)}</span>
        </div>
        <span className="text-2xl text-muted select-none">=</span>
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-[#cdbfa8] font-bold">Net Worth</span>
          <span className="text-2xl font-bold text-surface tabular-nums">{formatMoney(netWorth)}</span>
        </div>
      </div>

      {/* Debt Composition Donut */}
      {hasLiabilities && (
        <div className="bg-white rounded-2.5xl p-6 border border-inputBorder/20 shadow-sm flex items-center justify-start gap-8 flex-wrap mt-6">
          <div className="relative w-[150px] h-[150px] shrink-0">
            <div
              className="w-[150px] h-[150px] rounded-full shadow-inner"
              style={{ background: donutGradient }}
            ></div>
            <div className="absolute inset-[26px] rounded-full bg-white shadow-sm flex flex-col items-center justify-center select-none">
              <span className="text-[10px] text-faint font-bold">{t('overview.liabilitiesLabel')}</span>
              <span className="text-sm.5 font-bold text-dark tabular-nums leading-none mt-0.5">
                {formatMoney(totalLiabilities)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-[220px] flex flex-col gap-3">
            <h3 className="text-sm font-bold text-dark select-none">{language === 'th' ? 'สัดส่วนหนี้สิน' : 'Debt Allocation'}</h3>
            <div className="flex flex-col gap-2 font-semibold text-xs.5 text-dark/90 select-none">
              {liabilities.map((l, index) => {
                const share = totalLiabilities > 0 ? (Number(l.amount) / totalLiabilities) * 100 : 0;
                return (
                  <div key={l.id} className="flex items-center gap-2 select-none">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: debtPalette[index % 6] }}></div>
                    <span>{l.name}</span>
                    <span className="ml-auto font-bold tabular-nums">{formatMoney(Number(l.amount))}</span>
                    <span className="w-12 text-right text-faint-darker font-bold">{share.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasLiabilities && (
        <div className="bg-white border border-inputBorder/25 rounded-2.5xl p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-sm.5 text-muted">
            {language === 'th' ? 'ไม่มีหนี้สิน 🎉' : 'No liabilities 🎉'}
          </span>
        </div>
      )}

      {/* Liabilities List */}
      <div className="flex flex-col gap-2.5 mt-6">
        {liabilities.map((l) => (
          <div
            key={l.id}
            className="bg-white rounded-2xl p-4.5 flex items-center justify-between gap-4 border border-inputBorder/15 hover:border-inputBorder/30 shadow-sm transition-all duration-150"
          >
            <div className="flex items-center gap-3 select-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d98f70]"></div>
              <span className="text-[14.5px] font-bold text-dark">{l.name}</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-base font-bold text-dark tabular-nums">
                {formatMoney(Number(l.amount))}
              </span>
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

