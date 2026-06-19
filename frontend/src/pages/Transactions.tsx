import React from 'react';
import { useStore } from '../store/useStore';
import { useTransactions, useNetWorth } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const Transactions: React.FC = () => {
  const { openModal, currency } = useStore();
  const { data: transactions = [], deleteTransaction, isLoading } = useTransactions();
  const { summary } = useNetWorth();
  const { t, language } = useTranslation();

  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const formatNativePrimary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    if (isThb) {
      const decimalLimit = Math.abs(thb) < 1000 ? 2 : 0;
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

    if (isThb) {
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      const decimalLimit = Math.abs(thb) < 1000 ? 2 : 0;
      return '฿' + thb.toLocaleString('en-US', {
        minimumFractionDigits: decimalLimit,
        maximumFractionDigits: decimalLimit,
      });
    }
  };

  const formatQty = (qty: number, type: string) => {
    if (type === 'deposit') return `฿${qty.toLocaleString('en-US')}`;
    const fractionDigits = Math.abs(qty) < 10 ? 4 : 2;
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('transactions.confirmDeleteTx'))) {
      try {
        await deleteTransaction.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">{t('transactions.loadingTx')}</span>
      </div>
    );
  }

  const hasTxs = transactions.length > 0;

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Transactions">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-4.5 border-b border-inputBorder/20 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-dark">{t('transactions.title')}</h2>
          <span className="text-xs.5 text-faint-darker font-bold bg-[#f0e7d8] px-2 py-0.5 rounded-md mt-0.5">
            {transactions.length} {t('overview.itemsCount')}
          </span>
        </div>
        <button
          onClick={() => openModal('tx')}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm ml-auto"
          id="btn-add-txn-tx-page"
        >
          {t('transactions.recordBtn')}
        </button>
      </div>

      {/* Empty State */}
      {!hasTxs && (
        <div className="bg-white border border-inputBorder/25 rounded-2.5xl p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-sm.5 text-muted">{t('transactions.noTx')}</span>
        </div>
      )}

      {/* Table List */}
      {hasTxs && (
        <div className="bg-white rounded-2.5xl p-4 border border-inputBorder/20 shadow-sm overflow-x-auto mt-6">
          <table className="min-w-[820px] w-full border-collapse">
            <thead>
              <tr className="grid grid-cols-[110px_90px_1.5fr_1.2fr_1fr_1.1fr_1.2fr_44px] gap-2.5 px-3 py-2 text-[11.5px] font-bold text-faint-darker border-b border-inputBorder/20 text-left">
                <th>{t('transactions.colDate')}</th>
                <th>{t('transactions.colType')}</th>
                <th>{t('transactions.colAsset')}</th>
                <th>{t('transactions.colPort')}</th>
                <th className="text-right">{t('transactions.colQty')}</th>
                <th className="text-right">{t('transactions.colPrice')}</th>
                <th className="text-right">{t('transactions.colNetAmt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="flex flex-col gap-1 mt-1">
              {transactions.map((t) => {
                const asset = t.asset || { symbol: '?', type: 'crypto', currency: 'THB', portfolio: { name: '—' } };
                const isDep = asset.type === 'deposit';
                const isBuy = t.side === 'buy';
                const typeLabel = isDep
                  ? (isBuy ? (language === 'th' ? 'ฝาก' : 'Deposit') : (language === 'th' ? 'ถอน' : 'Withdraw'))
                  : (isBuy ? (language === 'th' ? 'ซื้อ' : 'BUY') : (language === 'th' ? 'ขาย' : 'SELL'));

                const totalValue = Number(t.quantity) * Number(t.price) + (isBuy ? Number(t.fee || 0) : -Number(t.fee || 0));

                return (
                  <tr
                    key={t.id}
                    className="grid grid-cols-[110px_90px_1.5fr_1.2fr_1fr_1.1fr_1.2fr_44px] gap-2.5 px-3 py-3 items-center rounded-xl hover:bg-surface transition-colors duration-150 border-b border-[#f7f0e3] last:border-none"
                  >
                    <td className="text-muted text-xs.5 font-medium select-none">{formatDate(t.date)}</td>
                    <td className="select-none">
                      <span
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full select-none ${
                          isBuy ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td className="font-bold text-dark">{asset.symbol}</td>
                    <td className="text-muted text-xs.5 font-medium">{asset.portfolio?.name || '—'}</td>
                    <td className="text-right font-semibold tabular-nums text-dark/90 text-sm">
                      {formatQty(Number(t.quantity), asset.type)}
                    </td>
                    <td className="text-right tabular-nums flex flex-col items-end">
                      {isDep ? (
                        <span className="font-semibold text-muted text-xs.5">—</span>
                      ) : (
                        <>
                          <span className="font-semibold text-muted text-xs.5">{formatNativePrimary(Number(t.price), asset.currency as any)}</span>
                          <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(Number(t.price), asset.currency as any)}</span>
                        </>
                      )}
                    </td>
                    <td className="text-right tabular-nums flex flex-col items-end">
                      <span className="font-bold text-dark text-sm">{formatNativePrimary(totalValue, asset.currency as any)}</span>
                      <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(totalValue, asset.currency as any)}</span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => handleDelete(t.id)}
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
};
